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
import { donateToRoom } from '../services/wallet.service.js';
import { goOfflineInternal, recordSongTransition } from '../services/room.service.js';
import { findAndActivateScheduledGame, recordAnswer, completeGame } from '../services/minigame.service.js';
import { Minigame } from '../models/minigame.model.js';
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
// Active game timers — keyed by roomId. Cleared when game ends or room goes offline.
const gameTimers = new Map();
// Track whether a game timer is blocking a pending song advance.
// { roomId → { currentSongIndex, currentSong, prevStart } }
const pendingAdvance = new Map();

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
    }, 2000);
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
    disconnectTimers.delete(roomId);
    songEndedDebounce.delete(roomId);
    pendingAdvance.delete(roomId);
    const gameTimer = gameTimers.get(roomId);
    if (gameTimer) { clearTimeout(gameTimer); gameTimers.delete(roomId); }
    const pendingNotify = notifyTimers.get(roomId);
    if (pendingNotify) { clearTimeout(pendingNotify); notifyTimers.delete(roomId); }

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

// ── Auth guard ───────────────────────────────────────────────────────────────

const canControlRoom = (userSession, roomSession) =>
    userSession && roomSession &&
    (roomSession.creatorId === userSession.userId || userSession.role === 'ADMIN');

// ── Socket Server ────────────────────────────────────────────────────────────

export const initializeSocket = (httpServer) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
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

                const isCreator = roomSession.creatorId === user.userId;

                // Creator page-reload: cancel the shutdown countdown automatically
                if (isCreator) {
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

                socket.emit('room:joined', {
                    roomId,
                    playback: playbackState ? { ...playbackState, currentSongPresignedUrl } : null,
                    serverTimestamp: Date.now(),
                    listenerCount:   roomSession.listenerCount,
                    isCreator,
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

                // Fetch index + startTimeUnix together
                const roomDoc      = await Room.findById(roomId).select('playback.currentSongIndex playback.startTimeUnix');
                const currentIndex = roomDoc?.playback?.currentSongIndex ?? 0;
                const prevStart    = roomDoc?.playback?.startTimeUnix ?? null;

                // Snapshot current song BEFORE advancing (needed for analytics)
                const playlist    = await socketManager.getCachedPlaylist(roomId);
                const currentSong = playlist?.[currentIndex] ?? null;

                const { nextSong, nextIndex, presignedUrl, startTimeUnix: nextStart } = await getNextSong(roomId, currentIndex);
                io.to(roomId).emit('room:song_changed', {
                    roomId, songIndex: nextIndex, song: nextSong,
                    songPresignedUrl: presignedUrl, startTimeUnix: nextStart, serverTimestamp: Date.now(),
                });
                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);

                // Fire-and-forget — analytics must not block playback
                recordSongTransition(roomId, currentSong, prevStart, true)
                    .catch(err => console.error('[room:skip analytics]', err.message));
            } catch (error) {
                socket.emit('room:error', { message: error.message });
            }
        });

        socket.on('room:seek', async ({ roomId, seekPositionMs }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                let roomSession   = await socketManager.getRoomById(roomId);
                if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
                if (!userSession) return socket.emit('room:error', { message: 'Session expired.' });
                if (!roomSession) return socket.emit('room:error', { message: 'Room session not found.' });
                if (!canControlRoom(userSession, roomSession)) return;
                const startTimeUnix = Date.now() - seekPositionMs;
                await socketManager.updateRoomPlaybackState(roomId, { startTimeUnix, isPlaying: true, pausedAtMs: null });
                io.to(roomId).emit('room:sync', { roomId, startTimeUnix, isPlaying: true, pausedAtMs: null, serverTimestamp: Date.now() });
            } catch (error) {
                console.error(`[Server] room:seek ERROR:`, error);
                socket.emit('room:error', { message: 'Failed to process seek.' });
            }
        });

        socket.on('room:pause', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                let roomSession   = await socketManager.getRoomById(roomId);
                if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
                if (!userSession) return socket.emit('room:error', { message: 'Session expired.' });
                if (!roomSession) return socket.emit('room:error', { message: 'Room session not found.' });
                if (!canControlRoom(userSession, roomSession)) return;
                if (!roomSession.isPlaying) return;
                const pausedAtMs = await socketManager.computeCurrentPositionMs(roomId);
                await socketManager.updateRoomPlaybackState(roomId, { isPlaying: false, pausedAtMs });
                io.to(roomId).emit('room:sync', { roomId, isPlaying: false, pausedAtMs, serverTimestamp: Date.now() });
            } catch (error) {
                console.error(`[Server] room:pause ERROR:`, error);
                socket.emit('room:error', { message: 'Failed to process pause.' });
            }
        });

        socket.on('room:resume', async ({ roomId }) => {
            try {
                const userSession = await socketManager.getUserBySocketId(socket.id);
                let roomSession   = await socketManager.getRoomById(roomId);
                if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
                if (!userSession) return socket.emit('room:error', { message: 'Session expired.' });
                if (!roomSession) return socket.emit('room:error', { message: 'Room session not found.' });
                if (!canControlRoom(userSession, roomSession)) return;
                if (roomSession.isPlaying) return;
                const pausedAtMs    = roomSession.pausedAtMs ?? 0;
                const startTimeUnix = Date.now() - pausedAtMs;
                await socketManager.updateRoomPlaybackState(roomId, { startTimeUnix, isPlaying: true, pausedAtMs: null });
                io.to(roomId).emit('room:sync', { roomId, startTimeUnix, isPlaying: true, pausedAtMs: null, serverTimestamp: Date.now() });
            } catch (error) {
                console.error(`[Server] room:resume ERROR:`, error);
                socket.emit('room:error', { message: 'Failed to process resume.' });
            }
        });

        socket.on('room:song_ended', async ({ roomId, currentSongIndex }) => {
            try {
                const lastAdvance = songEndedDebounce.get(roomId);
                if (lastAdvance && Date.now() - lastAdvance < 3000) return;
                // Don't advance if a game timer is already blocking this room
                if (gameTimers.has(roomId)) return;

                const roomDoc   = await Room.findById(roomId).select('playback.currentSongIndex playback.startTimeUnix');
                if (!roomDoc) return;
                const serverIndex = roomDoc.playback?.currentSongIndex ?? 0;
                if (currentSongIndex !== serverIndex) return;
                songEndedDebounce.set(roomId, Date.now());

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
                        io.to(roomId).emit('room:game_result', {
                            roomId,
                            minigameId:       activeGame._id.toString(),
                            winner:           completed?.winner ?? null,
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
                    const completed = await completeGame(game._id);
                    io.to(roomId).emit('room:game_result', {
                        roomId,
                        minigameId:       game._id.toString(),
                        winner:           completed?.winner ?? null,
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

                const result = await recordAnswer(minigameId, userSession.userId, userSession.userName, answer.trim());
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
                    io.to(roomId).emit('room:game_result', {
                        roomId, minigameId,
                        winner:           completed?.winner ?? null,
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

        socket.on('disconnect', async () => {
            const userSession = await socketManager.getUserBySocketId(socket.id);

            if (userSession?.currentRoomId) {
                const roomId      = userSession.currentRoomId;
                const roomSession = await socketManager.getRoomById(roomId);

                if (roomSession && roomSession.creatorId === userSession.userId) {
                    const SILENT_MS = 10_000;  // silent reconnect window — no notification shown
                    const GRACE_MS  = 45_000;  // total time before room closes

                    // Delay notification by SILENT_MS so a quick page reload never shows
                    // the countdown to listeners at all.
                    const notifyTimer = setTimeout(() => {
                        notifyTimers.delete(roomId);
                        const remaining = Math.floor((GRACE_MS - SILENT_MS) / 1000);
                        io.to(roomId).emit('room:creator_disconnected', {
                            roomId,
                            countdownSeconds: remaining,
                            message:   'Creator disconnected. Room going offline soon...',
                            closingAt: new Date(Date.now() + (GRACE_MS - SILENT_MS)),
                        });
                    }, SILENT_MS);
                    notifyTimers.set(roomId, notifyTimer);

                    const timer = setTimeout(() => goOfflineAndNotify(io, roomId, 'creator_disconnected'), GRACE_MS);
                    disconnectTimers.set(roomId, timer);
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

export default initializeSocket;
