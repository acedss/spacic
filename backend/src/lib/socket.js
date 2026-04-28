// Socket.IO Server: Real-time playback sync + Room events
// No pub/sub Redis adapter — single-process, in-memory adapter handles all broadcasts.

import { Server } from 'socket.io';
import { socketManager } from './socket-manager.js';
import { setIo } from './io.js';
import { User } from '../models/user.model.js';
import { Listener } from '../models/listener.model.js';
import { Room } from '../models/room.model.js';
import { Song } from '../models/song.model.js';
import { Friendship } from '../models/friendship.model.js';
import { getPresignedUrl } from '../services/s3.services.js';
import { socketRateLimit } from './socketRateLimit.js';
import { once } from './idempotency.js';
import { donateToRoom } from '../services/wallet.service.js';
import { event as logEvent } from './log.js';
import { goOfflineInternal, recordSongTransition } from '../services/room.service.js';
import { findAndActivateScheduledGame, recordAnswer, completeGame, settleGamePrize } from '../services/minigame.service.js';
import { Minigame } from '../models/minigame.model.js';
import { SongReaction } from '../models/songReaction.model.js';
import geoip from 'geoip-lite';

// Per-process timers — intentionally not in Redis.
// syncIntervals: lightweight heartbeat, one per room per process.
// disconnectTimers: 15s countdown, must fire on the process that started it.
// notifyTimers: delayed "creator disconnected" notification — silent reconnect window.
const syncIntervals    = new Map();
const disconnectTimers = new Map();
const notifyTimers     = new Map();
// Debounce: multiple clients fire song_ended simultaneously; only first within 3s wins.
const songEndedDebounce = new Map();

// ── Feature-flags cache ───────────────────────────────────────────────────────
// 30-second in-process cache keyed by roomId. Avoids per-event DB queries while
// allowing creator flag changes to propagate within half a minute.
// room:audio_chunk fires at audio streaming rate — caching is critical there.
// Cleared on goOffline; invalidated immediately by updateFeatureFlags REST handler.
const featureFlagsCache = new Map(); // roomId → { flags, expiresAt }

const getFeatureFlags = async (roomId) => {
    const cached = featureFlagsCache.get(roomId);
    if (cached && cached.expiresAt > Date.now()) return cached.flags;
    const doc = await Room.findById(roomId).select('featureFlags').lean();
    const flags = doc?.featureFlags ?? {};
    featureFlagsCache.set(roomId, { flags, expiresAt: Date.now() + 30_000 });
    return flags;
};
// Active game timers — keyed by roomId. Cleared when game ends or room goes offline.
const gameTimers = new Map();
// Track whether a game timer is blocking a pending song advance.
// { roomId → { currentSongIndex, currentSong, prevStart } }
const pendingAdvance = new Map();
// Creator speaking timers — 10s hard limit per room.
const creatorSpeakTimers = new Map();
// Song-ending-soon timers — notify creator 15s before song ends.
const songEndingSoonTimers = new Map();

// ── Heartbeat ────────────────────────────────────────────────────────────────

const startSyncCheckpoint = (io, roomId) => {
    if (syncIntervals.has(roomId)) return;
    const interval = setInterval(async () => {
        const state = await socketManager.getRoomPlaybackState(roomId);
        const room  = await socketManager.getRoomById(roomId);
        if (!state || !room) return;
        io.to(roomId).emit('room:sync_checkpoint', {
            roomId,
            startTimeUnix: state.startTimeUnix,
            pausedAtMs:    state.pausedAtMs,
            isPlaying:     state.isPlaying,
            serverTimestamp: Date.now(),
            listenerCount: room.listenerCount,
        });
    }, 5000);
    syncIntervals.set(roomId, interval);
};

const stopSyncCheckpoint = (roomId) => {
    const interval = syncIntervals.get(roomId);
    if (interval) { clearInterval(interval); syncIntervals.delete(roomId); }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const emitSystemMessage = (io, roomId, text) => {
    io.to(roomId).emit('room:chat_message', {
        id: `sys-${crypto.randomUUID()}`,
        user: { id: 'system', username: 'System' },
        message: text,
        sentAt: new Date().toISOString(),
        isSystem: true,
    });
};

// Notify all friends of a user that their activity feed should refresh.
// Accepts a single userId or an array to batch-notify after room shutdown.
const notifyFriendsActivityChanged = async (io, userIdOrIds) => {
    try {
        const ids = Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds];

        const friendships = await Friendship.find({
            $or: [{ requester: { $in: ids } }, { recipient: { $in: ids } }],
            status: 'accepted',
        }).select('requester recipient');

        // Collect unique friend IDs to notify — avoid duplicates when multiple
        // users in a room share the same friend
        const toNotify = new Set();
        for (const f of friendships) {
            const rStr = f.requester.toString();
            const rcStr = f.recipient.toString();
            const isRequester = ids.some((id) => id.toString() === rStr);
            toNotify.add(isRequester ? rcStr : rStr);
        }

        // Single chained emit rather than N individual io.to() calls
        if (toNotify.size === 0) return;
        let emitter = io;
        for (const friendId of toNotify) emitter = emitter.to(friendId);
        emitter.emit('friend:activity_changed');
    } catch (err) {
        console.error('[Socket] notifyFriendsActivityChanged error:', err.message);
    }
};

const goOfflineAndNotify = async (io, roomId, reason) => {
    stopSyncCheckpoint(roomId);
    stopSessionTimer(roomId);
    disconnectTimers.delete(roomId);
    featureFlagsCache.delete(roomId);
    songEndedDebounce.delete(roomId);
    pendingAdvance.delete(roomId);
    const gameTimer = gameTimers.get(roomId);
    if (gameTimer) { clearTimeout(gameTimer); gameTimers.delete(roomId); }
    const pendingNotify = notifyTimers.get(roomId);
    if (pendingNotify) { clearTimeout(pendingNotify); notifyTimers.delete(roomId); }
    await Promise.all([
        clearPerSongState(roomId),
        socketManager.clearQueueVotes(roomId),
    ]);

    // Capture listener IDs BEFORE goOfflineInternal marks them inactive + clears Redis
    const activeListeners = await Listener.find({ roomId, isActive: true }).select('userId');

    await goOfflineInternal(roomId);
    io.to(roomId).emit('room:offline', { roomId, reason });

    // One batched query for all listener IDs instead of N individual queries
    const listenerIds = activeListeners.map((l) => l.userId);
    if (listenerIds.length > 0) notifyFriendsActivityChanged(io, listenerIds);
};

// ── User Resolution (cache → DB fallback) ────────────────────────────────────

const resolveUser = async (clerkId) => {
    const cached = await socketManager.getCachedUser(clerkId);
    if (cached) return cached;

    const dbUser = await User.findOne({ clerkId });
    if (!dbUser) return null;

    const user = {
        userId:   dbUser._id.toString(),
        fullName: dbUser.fullName,
        imageUrl: dbUser.imageUrl,
        role:     dbUser.role,
        userTier: dbUser.userTier,
    };
    await socketManager.cacheUser(clerkId, user);
    return user;
};

// ── Session Recovery ──────────────────────────────────────────────────────────

const recoverSessionFromDB = async (roomId) => {
    const room = await Room.findById(roomId).populate('playlist');
    if (!room || room.status !== 'live') return null;

    await socketManager.cacheRoomPlaylist(roomId, room.playlist.map((s) => ({
        _id: s._id.toString(), title: s.title, artist: s.artist,
        duration: s.duration, imageUrl: s.imageUrl || '', s3Key: s.s3Key,
        albumId: s.albumId?.toString() ?? null,
    })));

    const idx         = room.playback?.currentSongIndex ?? 0;
    const currentSong = room.playlist[idx];

    return socketManager.addRoomSession(roomId, {
        creatorId:        room.creatorId.toString(),
        title:            room.title,
        capacity:         room.capacity,
        currentSongId:    currentSong?._id.toString()  ?? null,
        currentSongS3Key: currentSong?.s3Key           ?? null,
        startTimeUnix:    room.playback?.startTimeUnix ?? null,
        pausedAtMs:       room.playback?.pausedAtMs    ?? 0,
        isPlaying:        true,
    });
};

// ── Next Song ─────────────────────────────────────────────────────────────────

const getNextSong = async (roomId, currentIndex) => {
    let playlist = await socketManager.getCachedPlaylist(roomId);

    if (!playlist) {
        const room = await Room.findById(roomId).populate('playlist');
        if (!room) throw new Error('Room not found');
        playlist = room.playlist.map((s) => ({
            _id: s._id.toString(), title: s.title, artist: s.artist,
            duration: s.duration, imageUrl: s.imageUrl || '', s3Key: s.s3Key,
            albumId: s.albumId?.toString() ?? null,
        }));
        await socketManager.cacheRoomPlaylist(roomId, playlist);
    }

    const nextIndex = currentIndex + 1;
    let nextSong;

    if (nextIndex < playlist.length) {
        nextSong = playlist[nextIndex];
    } else {
        const excludeIds = playlist.map((s) => s._id);
        [nextSong] = await Song.aggregate([{ $match: { _id: { $nin: excludeIds } } }, { $sample: { size: 1 } }]);
        if (!nextSong) [nextSong] = await Song.aggregate([{ $sample: { size: 1 } }]);
        if (!nextSong) throw new Error('No songs available');

        const newSongData = {
            _id: nextSong._id.toString(), title: nextSong.title, artist: nextSong.artist,
            duration: nextSong.duration, imageUrl: nextSong.imageUrl || '', s3Key: nextSong.s3Key,
            albumId: nextSong.albumId?.toString() ?? null,
        };

        await Room.findByIdAndUpdate(roomId, { $push: { playlist: nextSong._id } });
        await socketManager.cacheRoomPlaylist(roomId, [...playlist, newSongData]);
        nextSong = newSongData;
    }

    const presignedUrl  = await getPresignedUrl(nextSong.s3Key);
    const startTimeUnix = Date.now();

    await Room.findByIdAndUpdate(roomId, {
        'playback.currentSongIndex': nextIndex,
        'playback.startTimeUnix':    startTimeUnix,
        'playback.pausedAtMs':       0,
        'playback.lastSyncAt':       new Date(),
    });

    await socketManager.updateRoomPlaybackState(roomId, {
        currentSongId: nextSong._id.toString(), currentSongS3Key: nextSong.s3Key,
        startTimeUnix, pausedAtMs: null, isPlaying: true,
    });

    return { nextSong, nextIndex, presignedUrl, startTimeUnix };
};

// ── Song-Ending-Soon Notifier ─────────────────────────────────────────────────
// Call whenever a new song starts. Notifies the creator 15s before song ends
// so they can prepare their mic introduction for the next track.

const scheduleSongEndingSoon = (io, roomId, creatorId, durationMs) => {
    const existing = songEndingSoonTimers.get(roomId);
    if (existing) clearTimeout(existing);

    const WARN_BEFORE_MS = 15_000;
    const delay = durationMs - WARN_BEFORE_MS;
    if (delay <= 0) return; // song too short for a warning

    const timer = setTimeout(() => {
        songEndingSoonTimers.delete(roomId);
        // Emit only to the creator's personal socket room (creatorId)
        io.to(creatorId).emit('room:song_ending_soon', { roomId });
    }, delay);
    songEndingSoonTimers.set(roomId, timer);
};

// ── Per-song cleanup (votes + reactions) ─────────────────────────────────────

const clearPerSongState = async (roomId) => {
    await Promise.all([
        socketManager.clearSkipVotes(roomId),
        socketManager.clearSongReactions(roomId),
    ]);
};

// ── Session Time Limit ───────────────────────────────────────────────────────
// Per-tier: FREE=60min, PREMIUM=180min, CREATOR=unlimited.
// Timer starts on goLive, emits warnings, auto-closes room.

const sessionTimers = new Map();
const sessionWarningTimers = new Map();

const startSessionTimer = (io, roomId, maxMinutes) => {
    if (!Number.isFinite(maxMinutes)) return;
    const maxMs = maxMinutes * 60_000;
    const warnMs = maxMs - 5 * 60_000; // warn 5min before

    if (warnMs > 0) {
        const warnTimer = setTimeout(() => {
            sessionWarningTimers.delete(roomId);
            io.to(roomId).emit('room:session_warning', {
                roomId,
                remainingMinutes: 5,
                message: 'Session ending in 5 minutes — upgrade for longer sessions!',
            });
        }, warnMs);
        sessionWarningTimers.set(roomId, warnTimer);
    }

    const timer = setTimeout(() => {
        sessionTimers.delete(roomId);
        sessionWarningTimers.delete(roomId);
        io.to(roomId).emit('room:session_expired', {
            roomId,
            message: 'Session time limit reached. Room going offline.',
        });
        goOfflineAndNotify(io, roomId, 'session_time_limit');
    }, maxMs);
    sessionTimers.set(roomId, timer);
};

const stopSessionTimer = (roomId) => {
    const timer = sessionTimers.get(roomId);
    if (timer) { clearTimeout(timer); sessionTimers.delete(roomId); }
    const warn = sessionWarningTimers.get(roomId);
    if (warn) { clearTimeout(warn); sessionWarningTimers.delete(roomId); }
};

// ── Auth guard ───────────────────────────────────────────────────────────────

const canControlRoom = (userSession, roomSession) =>
    userSession && roomSession &&
    (roomSession.creatorId === userSession.userId || userSession.role === 'ADMIN');

// ── Socket Server ────────────────────────────────────────────────────────────

export const initializeSocket = (httpServer) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim());
    const io = new Server(httpServer, {
        cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    });
    setIo(io);

    io.on('connection', async (socket) => {

        socket.on('room:join', async ({ roomId, clerkId: userClerkId }) => {
            try {
                const user = await resolveUser(userClerkId);
                if (!user) return socket.emit('room:error', { message: 'User not found' });

                let roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession) {
                    roomSession = await recoverSessionFromDB(roomId);
                    if (!roomSession) return socket.emit('room:error', { message: 'Room not found or not live' });
                }

                if (await socketManager.isRoomAtCapacity(roomId)) {
                    return socket.emit('room:error', { message: 'Room is at capacity' });
                }

                socket.join(roomId);
                await socketManager.addRoomListener(roomId, user.userId);
                await socketManager.updateUserCurrentRoom(socket.id, roomId);
                startSyncCheckpoint(io, roomId);

                // Resolve geo from IP (synchronous lookup, sub-millisecond, no external call)
                const rawIp = (socket.handshake.headers['x-forwarded-for'] ?? '')
                    .split(',')[0].trim() || socket.handshake.address;
                const ip  = rawIp.replace(/^::ffff:/, ''); // strip IPv4-mapped IPv6
                const geo = geoip.lookup(ip);

                // Persist to DB so activity feed (getFriendsActivity) can find active listeners
                await Listener.findOneAndUpdate(
                    { roomId, userId: user.userId },
                    {
                        isActive: true, joinedAt: new Date(), $unset: { leftAt: '' },
                        country: geo?.country ?? null,
                        region:  geo?.region  ?? null,
                        city:    geo?.city    ?? null,
                    },
                    { upsert: true }
                );

                const playbackState = await socketManager.getRoomPlaybackState(roomId);
                let currentSongPresignedUrl = null;
                if (playbackState?.currentSongS3Key) {
                    currentSongPresignedUrl = await getPresignedUrl(playbackState.currentSongS3Key);
                }

                // Fetch current song index + metadata for rejoin sync.
                // playbackState only has s3Key/id; index and metadata need DB + cache.
                const roomPlaybackDoc = await Room.findById(roomId).select('playback.currentSongIndex').lean();
                const currentSongIndex = roomPlaybackDoc?.playback?.currentSongIndex ?? 0;
                const cachedPlaylist   = await socketManager.getCachedPlaylist(roomId);
                const currentSongData  = cachedPlaylist?.[currentSongIndex] ?? null;

                const isCreator = roomSession.creatorId === user.userId;

                // Creator page-reload: cancel the shutdown countdown automatically
                if (isCreator) {
                    // Start session timer if not already running (first creator join or reconnect)
                    if (!sessionTimers.has(roomId)) {
                        const creatorUser = await User.findById(user.userId).select('userTier').lean();
                        const maxMins = socketManager.getMaxSessionMinutesByTier(creatorUser?.userTier);
                        // Offset by time already elapsed since liveAt
                        const room = await Room.findById(roomId).select('liveAt').lean();
                        const elapsedMs = room?.liveAt ? Date.now() - new Date(room.liveAt).getTime() : 0;
                        const remainingMins = maxMins - (elapsedMs / 60_000);
                        if (remainingMins > 0) {
                            startSessionTimer(io, roomId, remainingMins);
                        } else if (Number.isFinite(maxMins)) {
                            goOfflineAndNotify(io, roomId, 'session_time_limit');
                            return;
                        }
                    }

                    const pendingNotify = notifyTimers.get(roomId);
                    if (pendingNotify) { clearTimeout(pendingNotify); notifyTimers.delete(roomId); }

                    const pendingTimer = disconnectTimers.get(roomId);
                    if (pendingTimer) {
                        clearTimeout(pendingTimer);
                        disconnectTimers.delete(roomId);
                        await Room.findByIdAndUpdate(roomId, { status: 'live' });
                        io.to(roomId).emit('room:creator_reconnected', {
                            roomId, message: 'Creator is back!',
                        });
                    }
                }

                // If a game is currently active in this room, include it so late-joiners see it
                const activeGame = await Minigame.findOne({ roomId, status: 'active' }).lean();

                // Resolve session time limit for this room's creator tier
                const creatorDoc = await User.findById(roomSession.creatorId).select('userTier').lean();
                const maxSessionMinutes = socketManager.getMaxSessionMinutesByTier(creatorDoc?.userTier);
                const roomForLiveAt = await Room.findById(roomId).select('liveAt voteThresholdPercent').lean();

                // Current reaction counts for the playing song
                const reactionCounts = await socketManager.getSongReactionCounts(roomId);
                const skipVoteCount  = await socketManager.getSkipVoteCount(roomId);
                const skipNeeded     = Math.max(1, Math.ceil(
                    (roomSession.listenerCount || 1) * (roomForLiveAt?.voteThresholdPercent ?? 50) / 100
                ));

                socket.emit('room:joined', {
                    roomId,
                    playback: playbackState ? {
                        ...playbackState,
                        currentSongPresignedUrl,
                        currentSongIndex,
                        currentSong: currentSongData,
                    } : null,
                    serverTimestamp: Date.now(),
                    listenerCount:   roomSession.listenerCount,
                    isCreator,
                    sessionInfo: {
                        maxSessionMinutes: Number.isFinite(maxSessionMinutes) ? maxSessionMinutes : null,
                        liveAt: roomForLiveAt?.liveAt?.toISOString?.() ?? roomForLiveAt?.liveAt ?? null,
                        voteThresholdPercent: roomForLiveAt?.voteThresholdPercent ?? 50,
                    },
                    reactions: reactionCounts,
                    skipVotes: { count: skipVoteCount, needed: skipNeeded },
                    activeGame: activeGame ? {
                        minigameId:      activeGame._id.toString(),
                        type:            activeGame.type,
                        title:           activeGame.title,
                        durationSeconds: activeGame.durationSeconds,
                        coinReward:      activeGame.coinReward,
                        config:          activeGame.config,
                        startedAt:       activeGame.startedAt?.toISOString() ?? null,
                        endsAt:          activeGame.startedAt
                            ? new Date(activeGame.startedAt.getTime() + activeGame.durationSeconds * 1000).toISOString()
                            : null,
                    } : null,
                });

                const updatedRoom = await socketManager.getRoomById(roomId);
                socket.to(roomId).emit('room:listener_joined', {
                    user: { id: user.userId, username: user.fullName, imageUrl: user.imageUrl },
                    listenerCount: updatedRoom?.listenerCount ?? 0,
                });
                emitSystemMessage(io, roomId, `${user.fullName} joined the room`);

                // Notify friends that this user joined a room
                await notifyFriendsActivityChanged(io, user.userId);
            } catch (error) {
                console.error(`[Server] room:join ERROR:`, error.message);
                socket.emit('room:error', { message: error.message });
            }
        });

        socket.on('room:leave', async ({ roomId, clerkId: userClerkId }) => {
            try {
                const user = await resolveUser(userClerkId);
                if (!user) return;

                socket.leave(roomId);
                await socketManager.removeRoomListener(roomId, user.userId);
                await socketManager.updateUserCurrentRoom(socket.id, null);

                await Listener.findOneAndUpdate(
                    { roomId, userId: user.userId, isActive: true },
                    { isActive: false, leftAt: new Date() }
                );

                const session = await socketManager.getRoomById(roomId);
                io.to(roomId).emit('room:listener_left', {
                    user: { id: user.userId, username: user.fullName },
                    listenerCount: session?.listenerCount ?? 0,
                    reason: 'voluntary_leave',
                });
                emitSystemMessage(io, roomId, `${user.fullName} left the room`);

                // Notify friends that this user left the room
                await notifyFriendsActivityChanged(io, user.userId);
            } catch (error) {
                console.error('room:leave error', error);
            }
        });

        socket.on('room:chat', async ({ roomId, message }) => {
            try {
                const trimmed = typeof message === 'string' ? message.trim() : '';
                if (!trimmed || trimmed.length > 500) return;
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const allowed = await socketRateLimit(userSession.userId, 'chat', { limit: 10, windowSec: 10, roomId });
                if (!allowed) return socket.emit('room:error', { message: 'Sending messages too fast — slow down' });
                const flags = await getFeatureFlags(roomId);
                if (flags.chat === false) return socket.emit('room:error', { message: 'Chat is disabled in this room' });
                io.to(roomId).emit('room:chat_message', {
                    id: `${Date.now()}-${socket.id}`,
                    user: { id: userSession.userId, username: userSession.userName, imageUrl: userSession.userImage },
                    message: trimmed,
                    sentAt: new Date().toISOString(),
                });
            } catch (error) {
                console.error('room:chat error', error);
            }
        });

        socket.on('room:donate', async ({ roomId, amount, idempotencyKey }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return socket.emit('room:error', { message: 'Session expired. Please refresh.' });
                if (!idempotencyKey) return socket.emit('room:error', { message: 'Missing idempotencyKey' });
                const allowedDonate = await socketRateLimit(userSession.userId, 'donate', { limit: 5, windowSec: 60, roomId });
                if (!allowedDonate) return socket.emit('room:error', { message: 'Too many donations — try again shortly' });
                const flags = await getFeatureFlags(roomId);
                if (flags.donations === false) return socket.emit('room:error', { message: 'Donations are disabled in this room' });

                const result = await donateToRoom(userSession.clerkId, roomId, amount, idempotencyKey);

                socket.emit('wallet:balance_updated', { balance: result.newBalance });
                io.to(roomId).emit('room:goal_updated', {
                    roomId, streamGoal: result.streamGoal,
                    streamGoalCurrent: result.streamGoalCurrent, donor: result.donor,
                });
                emitSystemMessage(io, roomId, `${result.donor.name} donated ${result.donor.amount.toLocaleString()} coins!`);

                if (result.goalReached) {
                    io.to(roomId).emit('room:goal_reached', { roomId });
                    emitSystemMessage(io, roomId, '🎉 Stream goal reached! Thank you all for your support!');
                }
            } catch (error) {
                socket.emit('room:error', { message: error.message });
            }
        });

        socket.on('room:update_goal', async ({ roomId, newGoal }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                const roomSession = await socketManager.getRoomById(roomId);
                if (!canControlRoom(userSession, roomSession)) {
                    return socket.emit('room:error', { message: 'Only the creator can update the stream goal' });
                }
                if (!Number.isInteger(newGoal) || newGoal <= 0) {
                    return socket.emit('room:error', { message: 'Goal must be a positive integer' });
                }
                const room = await Room.findById(roomId).select('streamGoalCurrent');
                if (!room) return socket.emit('room:error', { message: 'Room not found' });
                if (newGoal <= room.streamGoalCurrent) {
                    return socket.emit('room:error', { message: 'New goal must be higher than current donations' });
                }
                await Room.findByIdAndUpdate(roomId, { $set: { streamGoal: newGoal } });
                io.to(roomId).emit('room:goal_updated', {
                    roomId, streamGoal: newGoal, streamGoalCurrent: room.streamGoalCurrent, donor: null,
                });
                emitSystemMessage(io, roomId, `Creator raised the stream goal to ${newGoal.toLocaleString()} coins!`);
            } catch (error) {
                socket.emit('room:error', { message: error.message });
            }
        });

        socket.on('room:skip', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                const roomSession = await socketManager.getRoomById(roomId);
                if (!canControlRoom(userSession, roomSession)) {
                    return socket.emit('room:error', { message: 'Only the creator or admin can skip songs' });
                }

                const roomDoc      = await Room.findById(roomId).select('playback.currentSongIndex playback.startTimeUnix');
                const currentIndex = roomDoc?.playback?.currentSongIndex ?? 0;
                const prevStart    = roomDoc?.playback?.startTimeUnix ?? null;

                const playlist    = await socketManager.getCachedPlaylist(roomId);
                const currentSong = playlist?.[currentIndex] ?? null;

                await clearPerSongState(roomId);

                const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } = await getNextSong(roomId, currentIndex);
                io.to(roomId).emit('room:song_changed', {
                    roomId, songIndex: nextIndex, song: nextSong,
                    songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                });
                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
                const roomSess = await socketManager.getRoomById(roomId);
                if (roomSess?.creatorId && nextSong.duration) {
                    scheduleSongEndingSoon(io, roomId, roomSess.creatorId, nextSong.duration);
                }

                recordSongTransition(roomId, currentSong, prevStart, true)
                    .catch(err => console.error('[room:skip analytics]', err.message));
            } catch (error) {
                socket.emit('room:error', { message: error.message });
            }
        });

        // ── Vote to Skip (listeners) ─────────────────────────────────────────
        socket.on('room:vote_skip', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession) return;
                if (roomSession.creatorId === userSession.userId) {
                    return socket.emit('room:error', { message: 'Creator should use skip, not vote' });
                }
                const flags = await getFeatureFlags(roomId);
                if (flags.voting === false) return socket.emit('room:error', { message: 'Vote-skip is disabled in this room' });

                const alreadyVoted = await socketManager.hasVotedToSkip(roomId, userSession.userId);
                if (alreadyVoted) return socket.emit('room:error', { message: 'Already voted to skip' });

                await socketManager.addSkipVote(roomId, userSession.userId);
                const voteCount     = await socketManager.getSkipVoteCount(roomId);
                const listenerCount = roomSession.listenerCount || 1;

                const roomDoc  = await Room.findById(roomId).select('voteThresholdPercent');
                const threshold = roomDoc?.voteThresholdPercent ?? 50;
                const needed    = Math.max(1, Math.ceil(listenerCount * threshold / 100));

                io.to(roomId).emit('room:skip_vote_update', {
                    roomId, voteCount, needed, votedBy: userSession.userName,
                });

                if (voteCount >= needed) {
                    await clearPerSongState(roomId);
                    const roomDoc2     = await Room.findById(roomId).select('playback.currentSongIndex playback.startTimeUnix');
                    const currentIndex = roomDoc2?.playback?.currentSongIndex ?? 0;
                    const prevStart    = roomDoc2?.playback?.startTimeUnix ?? null;
                    const playlist     = await socketManager.getCachedPlaylist(roomId);
                    const currentSong  = playlist?.[currentIndex] ?? null;

                    const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } = await getNextSong(roomId, currentIndex);
                    io.to(roomId).emit('room:song_changed', {
                        roomId, songIndex: nextIndex, song: nextSong,
                        songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                    });
                    emitSystemMessage(io, roomId, `Listeners voted to skip! Now playing: ${nextSong.title}`);
                    recordSongTransition(roomId, currentSong, prevStart, true)
                        .catch(err => console.error('[vote_skip analytics]', err.message));
                }
            } catch (error) {
                console.error('[room:vote_skip]', error.message);
                socket.emit('room:error', { message: 'Vote failed' });
            }
        });

        // ── Song Reactions (like/dislike) ────────────────────────────────────
        socket.on('room:song_reaction', async ({ roomId, reaction }) => {
            try {
                if (reaction !== 'like' && reaction !== 'dislike') return;
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;

                const result = await socketManager.addSongReaction(roomId, userSession.userId, reaction);
                if (!result) return socket.emit('room:error', { message: 'Already reacted' });

                io.to(roomId).emit('room:reaction_update', {
                    roomId, likes: result.likes, dislikes: result.dislikes,
                });

                // Persist to MongoDB for RecSys (fire-and-forget)
                const playbackState = await socketManager.getRoomPlaybackState(roomId);
                if (playbackState?.currentSongId) {
                    SongReaction.findOneAndUpdate(
                        { userId: userSession.userId, songId: playbackState.currentSongId },
                        { reaction, roomId },
                        { upsert: true }
                    ).catch(err => console.error('[song_reaction persist]', err.message));
                }
            } catch (error) {
                console.error('[room:song_reaction]', error.message);
            }
        });

        // ── Tip Hold — broadcasts live coin rain to others while user holds the tip button ──
        // No wallet changes here; room:donate fires on release for the actual deduction.
        socket.on('room:tip_holding', async ({ roomId, amount }) => {
            try {
                if (!Number.isInteger(amount) || amount <= 0) return;
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                // Broadcast to the whole room including sender so the holder
                // also sees their own avatar appearing on screen
                io.to(roomId).emit('room:tip_rain', {
                    userId:   userSession.userId,
                    userName: userSession.userName,
                    imageUrl: userSession.userImage ?? '',
                    amount,
                });
            } catch (error) {
                console.error('[room:tip_holding]', error.message);
            }
        });

        // ── Emoji Burst (ephemeral, rate-limited) ────────────────────────────
        socket.on('room:emoji', async ({ roomId, emoji }) => {
            try {
                if (typeof emoji !== 'string' || emoji.length > 8) return;
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;

                const allowed = await socketManager.canSendEmoji(roomId, userSession.userId);
                if (!allowed) return;

                socket.to(roomId).emit('room:emoji_burst', {
                    userId: userSession.userId, userName: userSession.userName, emoji,
                });
            } catch (error) {
                console.error('[room:emoji]', error.message);
            }
        });

        // ── Queue Voting (nominate + upvote) ─────────────────────────────────
        socket.on('room:nominate_song', async ({ roomId, songId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const allowedNom = await socketRateLimit(userSession.userId, 'nominate', { limit: 3, windowSec: 30, roomId });
                if (!allowedNom) return socket.emit('room:error', { message: 'Nominating too quickly — wait a moment' });
                const flags = await getFeatureFlags(roomId);
                if (flags.voteQueue === false) return socket.emit('room:error', { message: 'Queue voting is disabled in this room' });

                const song = await Song.findById(songId).select('title artist').lean();
                if (!song) return socket.emit('room:error', { message: 'Song not found' });

                // Reject if the song is already on the room's playlist — otherwise
                // the eventual threshold breach is a no-op against $addToSet and the
                // nomination becomes orphaned.
                const alreadyQueued = await Room.exists({ _id: roomId, playlist: songId });
                if (alreadyQueued) {
                    // Self-heal a stale client: push the authoritative playlist back
                    // to just this socket so the user sees the song appear immediately.
                    const cachedPlaylist = await socketManager.getCachedPlaylist(roomId);
                    if (cachedPlaylist) socket.emit('room:playlist_updated', { playlist: cachedPlaylist });
                    // Self-heal silently: the refreshed playlist already tells the user.
                    return;
                }

                const nominations = await socketManager.nominateSong(roomId, songId, userSession.userId, {
                    title: song.title, artist: song.artist, nominatorName: userSession.userName,
                });
                console.log('[room:nominate_song]', { roomId, songId, userId: userSession.userId, nominationsCount: nominations?.length, nominations });
                if (!nominations) return socket.emit('room:error', { message: 'Song already nominated' });

                // If the nominator's auto-vote already meets the threshold (typical for
                // small rooms where needed=1), promote immediately — otherwise the
                // nomination is stuck because the nominator can't vote for it again.
                const roomSession = await socketManager.getRoomById(roomId);
                const roomDoc = await Room.findById(roomId).select('voteThresholdPercent');
                const threshold = roomDoc?.voteThresholdPercent ?? 50;
                const listenerCount = roomSession?.listenerCount || 1;
                const needed = Math.max(1, Math.ceil(listenerCount * threshold / 100));

                if (1 >= needed) {
                    const addRes = await Room.updateOne(
                        { _id: roomId, playlist: { $ne: songId } },
                        { $addToSet: { playlist: songId } },
                    );
                    await socketManager.removeNomination(roomId, songId);
                    const cleared = await socketManager.getQueueNominations(roomId);
                    io.to(roomId).emit('room:nominations_update', { roomId, nominations: cleared });

                    if (addRes.modifiedCount > 0) {
                        const playlist = await socketManager.getCachedPlaylist(roomId);
                        const fullSong = await Song.findById(songId).lean();
                        let updatedPlaylist = playlist;
                        if (playlist && fullSong) {
                            updatedPlaylist = [...playlist, {
                                _id: fullSong._id.toString(), title: fullSong.title, artist: fullSong.artist,
                                duration: fullSong.duration, imageUrl: fullSong.imageUrl || '',
                                s3Key: fullSong.s3Key, albumId: fullSong.albumId?.toString() ?? null,
                            }];
                            await socketManager.cacheRoomPlaylist(roomId, updatedPlaylist);
                        }
                        if (updatedPlaylist) io.to(roomId).emit('room:playlist_updated', { playlist: updatedPlaylist });
                        io.to(roomId).emit('room:queue_song_added', { roomId, songId, title: song.title });
                        emitSystemMessage(io, roomId, `"${song.title}" was added to the queue`);
                        logEvent('queue.song_added', { roomId, songId, title: song.title, votes: 1, viaNominate: true });
                    }
                    return;
                }

                console.log('[room:nominate_song] emit room:nominations_update', { roomId, count: nominations.length, needed, listenerCount });
                io.to(roomId).emit('room:nominations_update', { roomId, nominations });
                emitSystemMessage(io, roomId, `${userSession.userName} nominated "${song.title}"`);
            } catch (error) {
                console.error('[room:nominate_song] ERROR', error.message, error.stack);
                socket.emit('room:error', { message: 'Nomination failed' });
            }
        });

        socket.on('room:vote_queue', async ({ roomId, songId, clientEventId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                // Dedup duplicate clicks within 60s. clientEventId is optional;
                // if absent, fall back to a coarse user+song bucket.
                const dedupKey = clientEventId || `${userSession.userId}:${roomId}:${songId}`;
                if (!(await once('vote_queue', dedupKey, 60))) return;
                const flags = await getFeatureFlags(roomId);
                if (flags.voteQueue === false) return socket.emit('room:error', { message: 'Queue voting is disabled in this room' });

                const newScore = await socketManager.voteForSong(roomId, songId, userSession.userId);
                if (newScore === null) return socket.emit('room:error', { message: 'Already voted for this song' });

                const roomSession = await socketManager.getRoomById(roomId);
                const roomDoc     = await Room.findById(roomId).select('voteThresholdPercent');
                const threshold   = roomDoc?.voteThresholdPercent ?? 50;
                const listenerCount = roomSession?.listenerCount || 1;
                const needed = Math.max(1, Math.ceil(listenerCount * threshold / 100));

                if (newScore >= needed) {
                    // Idempotency: only broadcast if THIS call actually transitioned
                    // the song from "not in playlist" → "in playlist". Concurrent
                    // votes that arrive after the threshold was already met will
                    // get modifiedCount=0 and silently skip the duplicate broadcast.
                    const addRes = await Room.updateOne(
                        { _id: roomId, playlist: { $ne: songId } },
                        { $addToSet: { playlist: songId } }
                    );
                    if (addRes.modifiedCount === 0) {
                        // Song is already on the playlist (peer vote raced us, or it
                        // was nominated despite already being queued). Still clean up
                        // the orphan nomination so the UI doesn't stick at "threshold
                        // reached" forever.
                        await socketManager.removeNomination(roomId, songId);
                        const nominations = await socketManager.getQueueNominations(roomId);
                        io.to(roomId).emit('room:nominations_update', { roomId, nominations });
                        return;
                    }

                    const playlist = await socketManager.getCachedPlaylist(roomId);
                    const song = await Song.findById(songId).lean();
                    let updatedPlaylist = playlist;
                    if (playlist && song) {
                        const newEntry = {
                            _id: song._id.toString(), title: song.title, artist: song.artist,
                            duration: song.duration, imageUrl: song.imageUrl || '', s3Key: song.s3Key,
                            albumId: song.albumId?.toString() ?? null,
                        };
                        updatedPlaylist = [...playlist, newEntry];
                        await socketManager.cacheRoomPlaylist(roomId, updatedPlaylist);
                    }
                    await socketManager.removeNomination(roomId, songId);
                    const nominations = await socketManager.getQueueNominations(roomId);
                    io.to(roomId).emit('room:nominations_update', { roomId, nominations });
                    io.to(roomId).emit('room:queue_song_added', { roomId, songId, title: song?.title });
                    // Authoritative state broadcast — without this, clients keep stale playlists
                    // and the new song never appears in "Up Next" until a full room refresh.
                    if (updatedPlaylist) {
                        io.to(roomId).emit('room:playlist_updated', { playlist: updatedPlaylist });
                    }
                    emitSystemMessage(io, roomId, `"${song?.title}" was voted into the queue!`);
                    logEvent("queue.song_added", {
                        roomId, songId, title: song?.title, votes: newScore,
                    });
                } else {
                    const nominations = await socketManager.getQueueNominations(roomId);
                    io.to(roomId).emit('room:nominations_update', { roomId, nominations });
                }
            } catch (error) {
                console.error('[room:vote_queue]', error.message);
                socket.emit('room:error', { message: 'Vote failed' });
            }
        });

        socket.on('room:get_nominations', async ({ roomId }) => {
            try {
                const nominations = await socketManager.getQueueNominations(roomId);
                socket.emit('room:nominations_update', { roomId, nominations });
            } catch (error) {
                console.error('[room:get_nominations]', error.message);
            }
        });

        // ── Pin Chat Message (creator only) ─────────────────────────────────────
        socket.on('room:pin_message', async ({ roomId, messageId, message, userId, userName }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession || roomSession.creatorId !== userSession.userId) return;

                io.to(roomId).emit('room:message_pinned', {
                    id: messageId,
                    userId,
                    userName,
                    message,
                    pinnedAt: new Date().toISOString(),
                });
            } catch (error) {
                console.error('[room:pin_message]', error.message);
            }
        });


        socket.on('room:song_ended', async ({ roomId, currentSongIndex }) => {
            try {
                const lastAdvance = songEndedDebounce.get(roomId);
                if (lastAdvance && Date.now() - lastAdvance < 5000) return;
                // Don't advance if a game timer is already blocking this room
                if (gameTimers.has(roomId)) return;

                // Claim the debounce lock BEFORE any await. Without this, two
                // simultaneous song_ended events from different clients both pass
                // the check above (because neither has set the timestamp yet),
                // then both await Room.findById, then both advance — producing
                // the "3 random songs in rapid succession" bug.
                songEndedDebounce.set(roomId, Date.now());

                const roomDoc   = await Room.findById(roomId).select('playback.currentSongIndex playback.startTimeUnix');
                if (!roomDoc) { songEndedDebounce.delete(roomId); return; }
                const serverIndex = roomDoc.playback?.currentSongIndex ?? 0;
                if (currentSongIndex !== serverIndex) { songEndedDebounce.delete(roomId); return; }
                await clearPerSongState(roomId);

                const playlist    = await socketManager.getCachedPlaylist(roomId);
                const currentSong = playlist?.[currentSongIndex] ?? null;
                const prevStart   = roomDoc.playback?.startTimeUnix ?? null;

                // Check for a game scheduled at this transition point
                const afterGame  = await findAndActivateScheduledGame(roomId, 'after_song', currentSongIndex);
                const beforeGame = !afterGame
                    ? await findAndActivateScheduledGame(roomId, 'before_song', currentSongIndex + 1)
                    : null;
                const activeGame = afterGame ?? beforeGame;

                if (activeGame) {
                    // Store what to advance to once the game ends
                    pendingAdvance.set(roomId, { currentSongIndex, currentSong, prevStart });

                    io.to(roomId).emit('room:game_start', {
                        roomId,
                        minigameId:      activeGame._id.toString(),
                        type:            activeGame.type,
                        title:           activeGame.title,
                        durationSeconds: activeGame.durationSeconds,
                        coinReward:      activeGame.coinReward,
                        config:          activeGame.config,
                        startedAt:       new Date().toISOString(),
                        endsAt:          new Date(Date.now() + activeGame.durationSeconds * 1000).toISOString(),
                    });

                    const timer = setTimeout(async () => {
                        gameTimers.delete(roomId);
                        const completed = await completeGame(activeGame._id);
                        await settleGamePrize(completed).catch(err => console.error('[settleGamePrize]', err.message));
                        io.to(roomId).emit('room:game_result', {
                            roomId,
                            minigameId:       activeGame._id.toString(),
                            winner:           completed?.winner?.userId ? completed.winner : null,
                            participantCount: completed?.participantCount ?? 0,
                        });
                        // Brief pause before the next song starts
                        setTimeout(async () => {
                            try {
                                const advance = pendingAdvance.get(roomId);
                                pendingAdvance.delete(roomId);
                                const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } =
                                    await getNextSong(roomId, advance?.currentSongIndex ?? currentSongIndex);
                                io.to(roomId).emit('room:song_changed', {
                                    roomId, songIndex: nextIndex, song: nextSong,
                                    songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                                });
                                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
                                recordSongTransition(roomId, advance?.currentSong, advance?.prevStart, false)
                                    .catch(err => console.error('[game advance analytics]', err.message));
                            } catch (err) {
                                console.error('[game timer] advance song error:', err.message);
                            }
                        }, 3000); // 3s for listeners to see results before music starts
                    }, activeGame.durationSeconds * 1000);

                    gameTimers.set(roomId, timer);
                    return; // Don't advance the song now — game is running
                }

                const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } = await getNextSong(roomId, currentSongIndex);
                io.to(roomId).emit('room:song_changed', {
                    roomId, songIndex: nextIndex, song: nextSong,
                    songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                });
                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
                recordSongTransition(roomId, currentSong, prevStart, false)
                    .catch(err => console.error('[room:song_ended analytics]', err.message));
            } catch (error) {
                console.error('[Server] room:song_ended ERROR:', error);
                socket.emit('room:error', { message: 'Failed to advance to next song.' });
            }
        });

        // Creator manually triggers a draft or scheduled game mid-session
        socket.on('room:game_trigger', async ({ roomId, minigameId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                const roomSession = await socketManager.getRoomById(roomId);
                if (!canControlRoom(userSession, roomSession))
                    return socket.emit('room:error', { message: 'Only the creator can trigger games' });
                const flags = await getFeatureFlags(roomId);
                if (flags.minigames === false) return socket.emit('room:error', { message: 'Minigames are disabled in this room' });
                if (gameTimers.has(roomId))
                    return socket.emit('room:error', { message: 'A game is already running' });

                const game = await Minigame.findOneAndUpdate(
                    { _id: minigameId, roomId, status: { $in: ['draft', 'scheduled'] } },
                    { $set: { status: 'active', startedAt: new Date() } },
                    { new: true }
                );
                if (!game) return socket.emit('room:error', { message: 'Game not found or already active' });

                io.to(roomId).emit('room:game_start', {
                    roomId,
                    minigameId:      game._id.toString(),
                    type:            game.type,
                    title:           game.title,
                    durationSeconds: game.durationSeconds,
                    coinReward:      game.coinReward,
                    config:          game.config,
                    startedAt:       new Date().toISOString(),
                    endsAt:          new Date(Date.now() + game.durationSeconds * 1000).toISOString(),
                });

                const timer = setTimeout(async () => {
                    gameTimers.delete(roomId);
                    // 300ms grace period: allows any in-flight recordAnswer DB saves
                    // to complete before we snapshot winner state. Without this, a
                    // correct answer submitted in the last few ms races the timer.
                    await new Promise(r => setTimeout(r, 300));
                    const completed = await completeGame(game._id);
                    await settleGamePrize(completed).catch(err => console.error('[settleGamePrize]', err.message));
                    io.to(roomId).emit('room:game_result', {
                        roomId,
                        minigameId:       game._id.toString(),
                        winner:           completed?.winner?.userId ? completed.winner : null,
                        participantCount: completed?.participantCount ?? 0,
                    });
                }, game.durationSeconds * 1000);
                gameTimers.set(roomId, timer);
            } catch (error) {
                console.error('[Server] room:game_trigger ERROR:', error);
                socket.emit('room:error', { message: 'Failed to start game' });
            }
        });

        // Listener submits an answer during an active game
        socket.on('room:game_answer', async ({ roomId, minigameId, answer }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                if (typeof answer !== 'string' || answer.length > 200) return;
                const flags = await getFeatureFlags(roomId);
                if (flags.minigames === false) return;

                const result = await recordAnswer(minigameId, userSession.userId, userSession.fullName ?? userSession.userName, answer.trim());
                if (!result) return;

                // Broadcast updated participant count to everyone
                io.to(roomId).emit('room:game_progress', {
                    roomId, minigameId,
                    participantCount: result.game.participantCount,
                });

                // For guessing games: first correct answer ends the game immediately
                if (result.isWinner && ['song_guesser', 'lyric_fill', 'trivia'].includes(result.game.type)) {
                    const timer = gameTimers.get(roomId);
                    if (timer) { clearTimeout(timer); gameTimers.delete(roomId); }

                    const completed = await completeGame(minigameId);
                    await settleGamePrize().catch(err => console.error('[settleGamePrize]', err.message));
                    // Use in-memory winner from recordAnswer — more reliable thancompleted
                    // re-fetching completed doc which may lag behind the save.
                    const winnerData = result.game.winner;
                    io.to(roomId).emit('room:game_result', {
                        roomId, minigameId,
                        winner:           winnerData?.userId ? winnerData : null,
                        participantCount: completed?.participantCount ?? 0,
                    });

                    // If this game was blocking a song advance, resume after 3s
                    const advance = pendingAdvance.get(roomId);
                    if (advance) {
                        pendingAdvance.delete(roomId);
                        setTimeout(async () => {
                            try {
                                const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } =
                                    await getNextSong(roomId, advance.currentSongIndex);
                                io.to(roomId).emit('room:song_changed', {
                                    roomId, songIndex: nextIndex, song: nextSong,
                                    songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                                });
                                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
                                recordSongTransition(roomId, advance.currentSong, advance.prevStart, false)
                                    .catch(err => console.error('[early-win advance analytics]', err.message));
                            } catch (err) {
                                console.error('[early-win] advance song error:', err.message);
                            }
                        }, 3000);
                    }
                }
            } catch (error) {
                console.error('[Server] room:game_answer ERROR:', error);
            }
        });

        // ── Creator Mic / Speaking ─────────────────────────────────────────────
        // Creator announces they're about to speak (broadcast warning to listeners)
        socket.on('room:creator_speaking', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession || roomSession.creatorId !== userSession.userId) return;
                const flags = await getFeatureFlags(roomId);
                if (flags.liveMic === false) return socket.emit('room:error', { message: 'Live mic is disabled in this room' });

                // Set a server-side 10s hard limit — auto-ends speaking if creator forgets
                const existingTimer = creatorSpeakTimers.get(roomId);
                if (existingTimer) clearTimeout(existingTimer);
                const endTimer = setTimeout(() => {
                    creatorSpeakTimers.delete(roomId);
                    io.to(roomId).emit('room:creator_done', { roomId });
                }, 10_000);
                creatorSpeakTimers.set(roomId, endTimer);

                // Notify all listeners — they show an overlay and mute the music
                io.to(roomId).emit('room:creator_speaking', { roomId });
            } catch (err) {
                console.error('[room:creator_speaking]', err.message);
            }
        });

        // Relay raw audio chunk (base64) from creator to all listeners in-memory (no DB/S3)
        socket.on('room:audio_chunk', async ({ roomId, chunk }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession || roomSession.creatorId !== userSession.userId) return;
                if (typeof chunk !== 'string' || chunk.length > 65536) return; // ~48KB per chunk max
                const flags = await getFeatureFlags(roomId);
                if (flags.liveMic === false) return;

                // Relay chunk to all other sockets in the room (listeners only)
                socket.to(roomId).emit('room:audio_chunk', { roomId, chunk });
            } catch (err) {
                console.error('[room:audio_chunk]', err.message);
            }
        });

        // ── Broadcast Asset Playback ───────────────────────────────────────────
        // Creator triggers a pre-recorded/uploaded asset. Server fetches a short-lived
        // presigned GET URL and fans it out — listeners play it directly from S3.
        // This avoids relaying audio bytes through the server (unlike live mic chunks).
        socket.on('room:asset_play', async ({ roomId, assetId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;

                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession || roomSession.creatorId !== userSession.userId) return;
                const flags = await getFeatureFlags(roomId);
                if (flags.broadcasts === false) return;

                // Import lazily to avoid circular dep at module init time
                const { BroadcastAsset } = await import('../models/broadcastAsset.model.js');
                const { getPlaybackUrl }  = await import('../controllers/broadcastAsset.controller.js');

                const asset = await BroadcastAsset.findOne({ _id: assetId, status: 'ready' }).lean();
                if (!asset) return;

                const url = await getPlaybackUrl(asset.s3Key);

                io.to(roomId).emit('room:asset_broadcast', {
                    assetId:         asset._id.toString(),
                    label:           asset.label,
                    url,
                    durationSeconds: asset.durationSeconds ?? null,
                });
            } catch (err) {
                console.error('[room:asset_play]', err.message);
            }
        });

        // Creator finishes speaking — resume music
        socket.on('room:creator_done', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                if (!userSession) return;
                const roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession || roomSession.creatorId !== userSession.userId) return;

                const timer = creatorSpeakTimers.get(roomId);
                if (timer) { clearTimeout(timer); creatorSpeakTimers.delete(roomId); }

                io.to(roomId).emit('room:creator_done', { roomId });
            } catch (err) {
                console.error('[room:creator_done]', err.message);
            }
        });

        socket.on('disconnect', async () => {
            const userSession = await socketManager.getUserBySocketId(socket.id);

            if (userSession?.currentRoomId) {
                const roomId      = userSession.currentRoomId;
                const roomSession = await socketManager.getRoomById(roomId);

                if (roomSession && roomSession.creatorId === userSession.userId) {
                    // Creator disconnected (network drop / page reload).
                    // Room stays alive — playlist is in Redis, music keeps playing for listeners.
                    // Room only closes via manual goOffline (REST) or session time limit.
                    // Emit a non-scary "creator away" indicator; no countdown, no panic.
                    io.to(roomId).emit('room:creator_away', { roomId });
                } else {
                    await socketManager.removeRoomListener(roomId, userSession.userId);
                    const updatedRoom = await socketManager.getRoomById(roomId);
                    io.to(roomId).emit('room:listener_left', {
                        user: { id: userSession.userId, username: userSession.userName },
                        listenerCount: updatedRoom?.listenerCount ?? 0,
                        reason: 'network_disconnect',
                    });
                }
            }

            // Notify friends that this user went offline
            if (userSession?.userId) {
                await notifyFriendsActivityChanged(io, userSession.userId);
            }

            await socketManager.removeUserSession(socket.id);
        });

        socket.on('room:creator_reconnect', async ({ roomId, clerkId: userClerkId }) => {
            try {
                const user = await resolveUser(userClerkId);
                if (!user) return;

                // Rebuild Redis session from DB if it was lost (server restart / timer fired early)
                let roomSession = await socketManager.getRoomById(roomId);
                if (!roomSession) {
                    roomSession = await recoverSessionFromDB(roomId);
                    if (!roomSession) return; // room is offline — don't reconnect
                }

                if (roomSession.creatorId !== user.userId) return;

                const pendingNotify = notifyTimers.get(roomId);
                if (pendingNotify) { clearTimeout(pendingNotify); notifyTimers.delete(roomId); }

                const timer = disconnectTimers.get(roomId);
                if (timer) { clearTimeout(timer); disconnectTimers.delete(roomId); }

                await Room.findByIdAndUpdate(roomId, { status: 'live' });
                socket.join(roomId);
                startSyncCheckpoint(io, roomId); // restart heartbeat if it was stopped
                io.to(roomId).emit('room:creator_reconnected', { roomId, message: 'Creator is back! Resuming...' });
            } catch (error) {
                console.error('room:creator_reconnect error', error);
            }
        });

        // Async session setup (after all handlers registered)
        const { clerkId } = socket.handshake.auth || {};
        if (clerkId) {
            const user = await resolveUser(clerkId).catch(() => null);
            if (user) {
                await socketManager.addUserSession(socket.id, {
                    userId: user.userId, clerkId, userName: user.fullName,
                    userImage: user.imageUrl, userTier: user.userTier, role: user.role,
                });
                // Personal room — enables io.to(userId).emit(...) for friend events
                socket.join(user.userId);
            }
        }
    });

    return io;
};

export const invalidateFeatureFlagsCache = (roomId) => featureFlagsCache.delete(roomId);

export default initializeSocket;
