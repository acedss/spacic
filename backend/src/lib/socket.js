// Socket.IO Server: Real-time playback sync + Room events
// No pub/sub Redis adapter — single-process, in-memory adapter handles all broadcasts.

import { Server } from 'socket.io';
import { socketManager } from './socket-manager.js';
import { User } from '../models/user.model.js';
import { Listener } from '../models/listener.model.js';
import { Room } from '../models/room.model.js';
import { Song } from '../models/song.model.js';
import { getPresignedUrl } from '../services/s3.services.js';
import { donateToRoom } from '../services/wallet.service.js';
import { goOfflineInternal } from '../services/room.service.js';

// Per-process timers — intentionally not in Redis.
// syncIntervals: lightweight heartbeat, one per room per process.
// disconnectTimers: 15s countdown, must fire on the process that started it.
const syncIntervals    = new Map();
const disconnectTimers = new Map();
// Debounce: multiple clients fire song_ended simultaneously; only first within 3s wins.
const songEndedDebounce = new Map();

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

const goOfflineAndNotify = async (io, roomId, reason) => {
    stopSyncCheckpoint(roomId);
    disconnectTimers.delete(roomId);
    songEndedDebounce.delete(roomId);
    await goOfflineInternal(roomId);
    io.to(roomId).emit('room:offline', { roomId, reason });
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
    const io = new Server(httpServer, {
        cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'], credentials: true },
    });

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

                const playbackState = await socketManager.getRoomPlaybackState(roomId);
                let currentSongPresignedUrl = null;
                if (playbackState?.currentSongS3Key) {
                    currentSongPresignedUrl = await getPresignedUrl(playbackState.currentSongS3Key);
                }

                const isCreator = roomSession.creatorId === user.userId;
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
                const currentIndex = (await Room.findById(roomId).select('playback.currentSongIndex'))
                    ?.playback?.currentSongIndex ?? 0;
                const { nextSong, nextIndex, presignedUrl, startTimeUnix } = await getNextSong(roomId, currentIndex);
                io.to(roomId).emit('room:song_changed', {
                    roomId, songIndex: nextIndex, song: nextSong,
                    songPresignedUrl: presignedUrl, startTimeUnix, serverTimestamp: Date.now(),
                });
                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
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
                const room = await Room.findById(roomId).select('playback.currentSongIndex');
                if (!room) return;
                const serverIndex = room.playback?.currentSongIndex ?? 0;
                if (currentSongIndex !== serverIndex) return;
                songEndedDebounce.set(roomId, Date.now());
                const { nextSong, nextIndex, presignedUrl, startTimeUnix } = await getNextSong(roomId, currentSongIndex);
                io.to(roomId).emit('room:song_changed', {
                    roomId, songIndex: nextIndex, song: nextSong,
                    songPresignedUrl: presignedUrl, startTimeUnix, serverTimestamp: Date.now(),
                });
                emitSystemMessage(io, roomId, `Now playing: ${nextSong.title} — ${nextSong.artist}`);
            } catch (error) {
                console.error('[Server] room:song_ended ERROR:', error);
                socket.emit('room:error', { message: 'Failed to advance to next song.' });
            }
        });

        socket.on('disconnect', async () => {
            const userSession = await socketManager.getUserBySocketId(socket.id);

            if (userSession?.currentRoomId) {
                const roomId      = userSession.currentRoomId;
                const roomSession = await socketManager.getRoomById(roomId);

                if (roomSession && roomSession.creatorId === userSession.userId) {
                    // Room stays 'live' in DB during 15s countdown — only goOfflineAndNotify marks it offline
                    io.to(roomId).emit('room:creator_disconnected', {
                        roomId, countdownSeconds: 15,
                        message:   'Creator disconnected. Room going offline in 15 seconds...',
                        closingAt: new Date(Date.now() + 15000),
                    });
                    const timer = setTimeout(() => goOfflineAndNotify(io, roomId, 'creator_disconnected'), 15000);
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
            }
        }
    });

    return io;
};

export default initializeSocket;
