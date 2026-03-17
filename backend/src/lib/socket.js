// Socket.IO Server: Real-time playback sync + Room events
// All socketManager calls are now async (Redis-backed).
// Redis Adapter enables multi-instance broadcasting via pub/sub.

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import * as playbackManager from './playback-manager.js';
import * as playbackService from '../services/playback.service.js';
import { socketManager } from './socket-manager.js';
import { redisPub, redisSub } from './redis.js';
import { User } from '../models/user.model.js';
import { Listener } from '../models/listener.model.js';
import { Room } from '../models/room.model.js';
import { Song } from '../models/song.model.js';
import { getPresignedUrl } from '../services/s3.services.js';

// Per-process timers — intentionally not in Redis.
// syncIntervals: lightweight heartbeat, one per room per process.
// disconnectTimers: 15s countdown, must fire on the process that started it.
const syncIntervals = new Map();
const disconnectTimers = new Map();
// Debounce map for room:song_ended — tracks last advance timestamp per room.
// Multiple clients fire song_ended simultaneously; only the first within 3s wins.
const songEndedDebounce = new Map();

// ── Heartbeat ────────────────────────────────────────────────────────────────

const startSyncCheckpoint = (io, roomId) => {
  if (syncIntervals.has(roomId)) return;
  const interval = setInterval(async () => {
    const state = await socketManager.getRoomPlaybackState(roomId);
    const room = await socketManager.getRoomById(roomId);
    if (!state || !room) return;
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const socketsInRoom = roomSockets ? roomSockets.size : 0;
    console.log(`[Server] >> SEND room:sync_checkpoint | room=${roomId} socketsInRoom=${socketsInRoom} isPlaying=${state.isPlaying} startTimeUnix=${state.startTimeUnix}`);
    io.to(roomId).emit('room:sync_checkpoint', {
      roomId,
      startTimeUnix: state.startTimeUnix,
      pausedAtMs: state.pausedAtMs,
      isPlaying: state.isPlaying,
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

// Broadcast a system-level chat message to everyone in a room.
// System messages use a sentinel user so the frontend can style them differently.
const emitSystemMessage = (io, roomId, text) => {
  io.to(roomId).emit('room:chat_message', {
    id: `sys-${Date.now()}`,
    user: { id: 'system', username: 'System' },
    message: text,
    sentAt: new Date().toISOString(),
    isSystem: true,
  });
};

const closeRoomAndNotify = async (io, roomId, reason) => {
  stopSyncCheckpoint(roomId);
  disconnectTimers.delete(roomId);
  songEndedDebounce.delete(roomId);
  await socketManager.removeRoomSession(roomId);

  await Room.findByIdAndUpdate(roomId, { status: 'closed', 'lifecycle.closedAt': new Date() });
  await Listener.updateMany({ roomId, isActive: true }, { isActive: false, leftAt: new Date() });

  io.to(roomId).emit('room:closed', { roomId, reason });
};

// Rebuild the Redis room session from MongoDB after a server restart.
// Restores the time anchor so playback resumes exactly where it left off.
const recoverSessionFromDB = async (roomId) => {
  const room = await Room.findById(roomId).populate('playlist');
  if (!room || room.status !== 'active') return null;

  const idx = room.playback?.currentSongIndex ?? 0;
  const currentSong = room.playlist[idx];
  const presignedUrl = currentSong ? await getPresignedUrl(currentSong.s3Key) : null;

  return socketManager.addRoomSession(roomId, {
    creatorId: room.creatorId.toString(),
    title: room.title,
    capacity: room.capacity,
    currentSongId: currentSong?._id.toString() ?? null,
    currentSongPresignedUrl: presignedUrl,
    startTimeUnix: room.playback?.startTimeUnix ?? null,
    pausedAtMs: room.playback?.pausedAtMs ?? 0,
    isPlaying: true,
  });
};

// Advance to the next song. Shared by room:skip and room:song_ended.
// Returns { nextSong, nextIndex, presignedUrl, startTimeUnix }.
const getNextSong = async (roomId, currentIndex) => {
  const room = await Room.findById(roomId).populate('playlist');
  if (!room) throw new Error('Room not found');

  const nextIndex = currentIndex + 1;
  let nextSong;

  if (nextIndex < room.playlist.length) {
    nextSong = room.playlist[nextIndex];
  } else {
    const excludeIds = room.playlist.map((s) => s._id);
    [nextSong] = await Song.aggregate([{ $match: { _id: { $nin: excludeIds } } }, { $sample: { size: 1 } }]);
    if (!nextSong) [nextSong] = await Song.aggregate([{ $sample: { size: 1 } }]);
    if (!nextSong) throw new Error('No songs available');
    await Room.findByIdAndUpdate(roomId, { $push: { playlist: nextSong._id } });
  }

  const presignedUrl = await getPresignedUrl(nextSong.s3Key);
  const startTimeUnix = Date.now();

  await Room.findByIdAndUpdate(roomId, {
    'playback.currentSongIndex': nextIndex,
    'playback.startTimeUnix': startTimeUnix,
    'playback.pausedAtMs': 0,
    'playback.lastSyncAt': new Date(),
  });

  await socketManager.updateRoomPlaybackState(roomId, {
    currentSongId: nextSong._id.toString(),
    currentSongPresignedUrl: presignedUrl,
    startTimeUnix,
    pausedAtMs: null,
    isPlaying: true,
  });

  return { nextSong, nextIndex, presignedUrl, startTimeUnix };
};

// ── Auth guard ───────────────────────────────────────────────────────────────
// DRY helper: returns true if the socket's user may control the given room.
const canControlRoom = (userSession, roomSession) =>
  userSession && roomSession &&
  (roomSession.creatorId === userSession.userId || userSession.role === 'ADMIN');

// ── Socket Server ────────────────────────────────────────────────────────────

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'], credentials: true }
  });

  // Redis Adapter: only needed for multi-instance deployments (production).
  // In single-process dev, the default in-memory adapter is more reliable.
  if (process.env.NODE_ENV === 'production' && redisPub && redisSub) {
    io.adapter(createAdapter(redisPub, redisSub));
    console.log('[Socket] Redis adapter enabled (production mode)');
  } else {
    console.log('[Socket] Using in-memory adapter (dev mode)');
  }

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // ── CRITICAL: Register ALL event handlers synchronously ────────────────
    // The client emits room:join immediately on 'connect'. If we await
    // anything before registering handlers, the event arrives while the
    // connection callback is paused and gets silently dropped — the socket
    // never joins the room and misses every broadcast.

    socket.emit('playback:state', playbackManager.getPlaybackState());

    // ── Global playback (legacy) ────────────────────────────────────────────
    socket.on('playback:play', async (songId) => {
      try { io.emit('playback:state', await playbackService.playSong(songId)); }
      catch (error) { socket.emit('playback:error', { message: error.message }); }
    });
    socket.on('playback:pause', () => {
      try { io.emit('playback:state', playbackService.pausePlayback()); } catch {}
    });
    socket.on('playback:resume', () => {
      try { io.emit('playback:state', playbackService.resumePlayback()); } catch {}
    });
    socket.on('playback:update-time', (currentTime) => {
      try { io.emit('playback:state', playbackService.updatePlaybackTime(currentTime)); } catch {}
    });

    // ── Room: Join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomId, clerkId: userClerkId }) => {
      try {
        console.log(`[Server] << RECV room:join | socket=${socket.id} clerkId=${userClerkId} room=${roomId}`);
        const user = await User.findOne({ clerkId: userClerkId });
        if (!user) return socket.emit('room:error', { message: 'User not found' });

        let roomSession = await socketManager.getRoomById(roomId);
        if (!roomSession) {
          roomSession = await recoverSessionFromDB(roomId);
          if (!roomSession) return socket.emit('room:error', { message: 'Room not found or not active' });
        }

        if (await socketManager.isRoomAtCapacity(roomId)) {
          return socket.emit('room:error', { message: 'Room is at capacity' });
        }

        socket.join(roomId);
        await socketManager.addRoomListener(roomId, user._id.toString());
        await socketManager.updateUserCurrentRoom(socket.id, roomId);
        startSyncCheckpoint(io, roomId);

        const playbackState = await socketManager.getRoomPlaybackState(roomId);
        const isCreator = roomSession.creatorId === user._id.toString();

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        console.log(`[Server] >> SEND room:joined | socket=${socket.id} isCreator=${isCreator} isPlaying=${playbackState?.isPlaying} startTimeUnix=${playbackState?.startTimeUnix} socketsInRoom=${roomSockets ? roomSockets.size : 0}`);
        socket.emit('room:joined', {
          roomId,
          playback: playbackState,
          serverTimestamp: Date.now(),
          listenerCount: roomSession.listenerCount,
          isCreator,
        });

        const updatedRoom = await socketManager.getRoomById(roomId);
        socket.to(roomId).emit('room:listener_joined', {
          user: { id: user._id, username: user.fullName, imageUrl: user.imageUrl },
          listenerCount: updatedRoom?.listenerCount ?? 0,
        });
        emitSystemMessage(io, roomId, `${user.fullName} joined the room`);
      } catch (error) {
        console.error(`[Server] room:join ERROR:`, error.message);
        socket.emit('room:error', { message: error.message });
      }
    });

    // ── Room: Leave ─────────────────────────────────────────────────────────
    socket.on('room:leave', async ({ roomId, clerkId: userClerkId }) => {
      try {
        const user = await User.findOne({ clerkId: userClerkId });
        if (!user) return;

        socket.leave(roomId);
        await socketManager.removeRoomListener(roomId, user._id.toString());
        await socketManager.updateUserCurrentRoom(socket.id, null);

        await Listener.findOneAndUpdate(
          { roomId, userId: user._id, isActive: true },
          { isActive: false, leftAt: new Date() }
        );

        const session = await socketManager.getRoomById(roomId);
        io.to(roomId).emit('room:listener_left', {
          user: { id: user._id, username: user.fullName },
          listenerCount: session?.listenerCount ?? 0,
          reason: 'voluntary_leave',
        });
        emitSystemMessage(io, roomId, `${user.fullName} left the room`);
      } catch (error) {
        console.error('room:leave error', error);
      }
    });

    // ── Room: Chat ──────────────────────────────────────────────────────────
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

    // ── Room: Skip (creator/admin only) ─────────────────────────────────────
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

    // ── Room: Seek (creator/admin only) ─────────────────────────────────────
    socket.on('room:seek', async ({ roomId, seekPositionMs }) => {
      try {
        const userSession = await socketManager.getUserBySocketId(socket.id);
        let roomSession = await socketManager.getRoomById(roomId);
        if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
        console.log(`[Server] << RECV room:seek | socket=${socket.id} userId=${userSession?.userId} role=${userSession?.role} seekMs=${Math.round(seekPositionMs)} canControl=${canControlRoom(userSession, roomSession)}`);

        if (!userSession) {
          console.error(`[Server] ✗ room:seek — userSession NULL for socket=${socket.id}`);
          return socket.emit('room:error', { message: 'Session expired. Please refresh.' });
        }
        if (!roomSession) {
          console.error(`[Server] ✗ room:seek — roomSession NULL for room=${roomId}`);
          return socket.emit('room:error', { message: 'Room session not found.' });
        }
        if (!canControlRoom(userSession, roomSession)) {
          console.log(`[Server] ✗ BLOCKED room:seek — canControlRoom=false | creatorId=${roomSession?.creatorId} userId=${userSession?.userId} role=${userSession?.role}`);
          return;
        }

        const startTimeUnix = Date.now() - seekPositionMs;
        await socketManager.updateRoomPlaybackState(roomId, { startTimeUnix, isPlaying: true, pausedAtMs: null });

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const socketIds = roomSockets ? [...roomSockets] : [];
        console.log(`[Server] >> SEND room:sync (seek) | room=${roomId} socketsInRoom=${socketIds.length} sockets=[${socketIds.join(',')}] startTimeUnix=${startTimeUnix} positionMs=${Math.round(seekPositionMs)}`);

        const payload = { roomId, startTimeUnix, isPlaying: true, pausedAtMs: null, serverTimestamp: Date.now() };
        io.to(roomId).emit('room:sync', payload);
      } catch (error) {
        console.error(`[Server] room:seek ERROR:`, error);
        socket.emit('room:error', { message: 'Failed to process seek.' });
      }
    });

    // ── Room: Pause (creator/admin only) ────────────────────────────────────
    socket.on('room:pause', async ({ roomId }) => {
      try {
        const userSession = await socketManager.getUserBySocketId(socket.id);
        let roomSession = await socketManager.getRoomById(roomId);
        if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
        console.log(`[Server] << RECV room:pause | socket=${socket.id} userId=${userSession?.userId} canControl=${canControlRoom(userSession, roomSession)}`);

        if (!userSession) {
          console.error(`[Server] ✗ room:pause — userSession NULL for socket=${socket.id}`);
          return socket.emit('room:error', { message: 'Session expired. Please refresh.' });
        }
        if (!roomSession) {
          console.error(`[Server] ✗ room:pause — roomSession NULL for room=${roomId}`);
          return socket.emit('room:error', { message: 'Room session not found.' });
        }
        if (!canControlRoom(userSession, roomSession)) return;

        // Idempotency: ignore duplicate pause if already paused
        if (!roomSession.isPlaying) {
          console.log(`[Server] room:pause — already paused, ignoring duplicate from socket=${socket.id}`);
          return;
        }

        const pausedAtMs = await socketManager.computeCurrentPositionMs(roomId);
        await socketManager.updateRoomPlaybackState(roomId, { isPlaying: false, pausedAtMs });

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const socketIds = roomSockets ? [...roomSockets] : [];
        console.log(`[Server] >> SEND room:sync (pause) | room=${roomId} socketsInRoom=${socketIds.length} sockets=[${socketIds.join(',')}] pausedAtMs=${Math.round(pausedAtMs)}`);
        io.to(roomId).emit('room:sync', { roomId, isPlaying: false, pausedAtMs, serverTimestamp: Date.now() });
      } catch (error) {
        console.error(`[Server] room:pause ERROR:`, error);
        socket.emit('room:error', { message: 'Failed to process pause.' });
      }
    });

    // ── Room: Resume (creator/admin only) ───────────────────────────────────
    socket.on('room:resume', async ({ roomId }) => {
      try {
        const userSession = await socketManager.getUserBySocketId(socket.id);
        let roomSession = await socketManager.getRoomById(roomId);
        if (!roomSession) roomSession = await recoverSessionFromDB(roomId);
        console.log(`[Server] << RECV room:resume | socket=${socket.id} userId=${userSession?.userId} canControl=${canControlRoom(userSession, roomSession)}`);

        if (!userSession) {
          console.error(`[Server] ✗ room:resume — userSession NULL for socket=${socket.id}`);
          return socket.emit('room:error', { message: 'Session expired. Please refresh.' });
        }
        if (!roomSession) {
          console.error(`[Server] ✗ room:resume — roomSession NULL for room=${roomId}`);
          return socket.emit('room:error', { message: 'Room session not found.' });
        }
        if (!canControlRoom(userSession, roomSession)) return;

        // Idempotency: ignore duplicate resume if already playing
        if (roomSession.isPlaying) {
          console.log(`[Server] room:resume — already playing, ignoring duplicate from socket=${socket.id}`);
          return;
        }

        const pausedAtMs = roomSession.pausedAtMs ?? 0;
        const startTimeUnix = Date.now() - pausedAtMs;
        await socketManager.updateRoomPlaybackState(roomId, { startTimeUnix, isPlaying: true, pausedAtMs: null });

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const socketIds = roomSockets ? [...roomSockets] : [];
        console.log(`[Server] >> SEND room:sync (resume) | room=${roomId} socketsInRoom=${socketIds.length} sockets=[${socketIds.join(',')}] startTimeUnix=${startTimeUnix} resumeFromMs=${Math.round(pausedAtMs)}`);
        io.to(roomId).emit('room:sync', {
          roomId, startTimeUnix, isPlaying: true, pausedAtMs: null, serverTimestamp: Date.now(),
        });
      } catch (error) {
        console.error(`[Server] room:resume ERROR:`, error);
        socket.emit('room:error', { message: 'Failed to process resume.' });
      }
    });

    // ── Room: Song Ended (auto-advance) ─────────────────────────────────────
    socket.on('room:song_ended', async ({ roomId, currentSongIndex }) => {
      try {
        // Debounce: ignore duplicate song_ended events from multiple clients within 3s
        const lastAdvance = songEndedDebounce.get(roomId);
        if (lastAdvance && Date.now() - lastAdvance < 3000) {
          console.log(`[Server] room:song_ended — debounced (${Date.now() - lastAdvance}ms since last advance), ignoring`);
          return;
        }

        const room = await Room.findById(roomId).select('playback.currentSongIndex');
        if (!room) {
          console.error(`[Server] room:song_ended — room not found: ${roomId}`);
          return;
        }

        const serverIndex = room.playback?.currentSongIndex ?? 0;
        if (currentSongIndex !== serverIndex) {
          console.log(`[Server] room:song_ended — index mismatch (client=${currentSongIndex} server=${serverIndex}), ignoring`);
          return;
        }

        songEndedDebounce.set(roomId, Date.now());
        console.log(`[Server] room:song_ended — advancing from index ${currentSongIndex} in room=${roomId}`);
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

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      const userSession = await socketManager.getUserBySocketId(socket.id);

      if (userSession?.currentRoomId) {
        const roomId = userSession.currentRoomId;
        const roomSession = await socketManager.getRoomById(roomId);

        if (roomSession && roomSession.creatorId === userSession.userId) {
          await Room.findByIdAndUpdate(roomId, {
            status: 'closing',
            'lifecycle.disconnectedAt': new Date(),
            'lifecycle.closingAt': new Date(Date.now() + 15000),
          });
          io.to(roomId).emit('room:creator_disconnected', {
            roomId, countdownSeconds: 15,
            message: 'Creator disconnected. Room closing in 15 seconds...',
            closingAt: new Date(Date.now() + 15000),
          });
          const timer = setTimeout(() => closeRoomAndNotify(io, roomId, 'creator_disconnected'), 15000);
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

    // ── Creator Reconnect ────────────────────────────────────────────────────
    socket.on('room:creator_reconnect', async ({ roomId, clerkId: userClerkId }) => {
      try {
        const user = await User.findOne({ clerkId: userClerkId });
        if (!user) return;

        const roomSession = await socketManager.getRoomById(roomId);
        if (!roomSession || roomSession.creatorId !== user._id.toString()) return;

        const timer = disconnectTimers.get(roomId);
        if (timer) { clearTimeout(timer); disconnectTimers.delete(roomId); }

        await Room.findByIdAndUpdate(roomId, {
          status: 'active',
          'lifecycle.disconnectedAt': null,
          'lifecycle.closingAt': null,
        });
        socket.join(roomId);
        io.to(roomId).emit('room:creator_reconnected', { roomId, message: 'Creator is back! Resuming...' });
      } catch (error) {
        console.error('room:creator_reconnect error', error);
      }
    });

    // ── Async user session setup (AFTER all handlers are registered) ────────
    // This runs in the background — handlers above are already active.
    const { clerkId } = socket.handshake.auth || {};
    if (clerkId) {
      const user = await User.findOne({ clerkId }).catch(() => null);
      if (user) {
        await socketManager.addUserSession(socket.id, {
          userId: user._id.toString(),
          clerkId,
          userName: user.fullName,
          userImage: user.imageUrl,
          userTier: user.userTier,
          role: user.role,
        });
        console.log(`[Socket] User session ready | socket=${socket.id} userId=${user._id} role=${user.role}`);
      }
    }
  });

  return io;
};

export default initializeSocket;
