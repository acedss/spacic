// Redis-backed state manager for Socket.IO
// Replaces in-memory Maps with Redis so state survives server restarts
// and is shared across multiple Node.js instances.
//
// Key schema:
//   room:{roomId}            → HASH  (metadata + playback anchor)
//   room:{roomId}:listeners  → SET   (active listener userIds)
//   user:socket:{socketId}   → HASH  (session per socket connection)
//   active:rooms             → SET   (index of all live roomIds)

import { redis } from './redis.js';

// Centralise key construction to avoid typos across the file
const K = {
    room: (id) => `room:${id}`,
    listeners: (id) => `room:${id}:listeners`,
    socket: (id) => `user:socket:${id}`,
    activeRooms: () => 'active:rooms',
};

// User sessions auto-expire if the server never receives a disconnect event
// (e.g. container killed mid-session).
const USER_TTL_S = 86_400; // 24 hours

class SocketManager {

    // ── User Sessions ────────────────────────────────────────────────────────

    async addUserSession(socketId, userData) {
        await redis.hset(K.socket(socketId), {
            userId: userData.userId,
            clerkId: userData.clerkId,
            userName: userData.userName || '',
            userImage: userData.userImage || '',
            userTier: userData.userTier || 'FREE',
            role: userData.role || 'USER',
            currentRoomId: '',
        });
        await redis.expire(K.socket(socketId), USER_TTL_S);
    }

    async removeUserSession(socketId) {
        await redis.del(K.socket(socketId));
    }

    async getUserBySocketId(socketId) {
        const data = await redis.hgetall(K.socket(socketId));
        if (!data || !data.userId) return null;
        return { ...data, currentRoomId: data.currentRoomId || null };
    }

    async updateUserCurrentRoom(socketId, roomId) {
        await redis.hset(K.socket(socketId), 'currentRoomId', roomId ?? '');
    }

    // ── Room Sessions ────────────────────────────────────────────────────────

    async addRoomSession(roomId, roomData) {
        await redis.hset(K.room(roomId), {
            creatorId: roomData.creatorId,
            title: roomData.title || '',
            // Redis stores strings — always cast numbers explicitly
            capacity: String(roomData.capacity ?? 10),
            currentSongId: roomData.currentSongId || '',
            currentSongPresignedUrl: roomData.currentSongPresignedUrl || '',
            startTimeUnix: String(roomData.startTimeUnix ?? ''),
            pausedAtMs: String(roomData.pausedAtMs ?? 0),
            isPlaying: roomData.isPlaying ? '1' : '0',
        });
        await redis.sadd(K.activeRooms(), roomId);
        return this.getRoomById(roomId);
    }

    async getRoomById(roomId) {
        const data = await redis.hgetall(K.room(roomId));
        if (!data || !data.creatorId) return null;
        const listenerCount = await this.getListenerCount(roomId);
        return {
            creatorId: data.creatorId,
            title: data.title,
            capacity: Number(data.capacity),
            currentSongId: data.currentSongId || null,
            currentSongPresignedUrl: data.currentSongPresignedUrl || null,
            startTimeUnix: data.startTimeUnix ? Number(data.startTimeUnix) : null,
            pausedAtMs: Number(data.pausedAtMs ?? 0),
            isPlaying: data.isPlaying === '1',
            listenerCount,
        };
    }

    async removeRoomSession(roomId) {
        await redis.del(K.room(roomId), K.listeners(roomId));
        await redis.srem(K.activeRooms(), roomId);
    }

    // ── Listener Management ──────────────────────────────────────────────────
    // Redis Sets are perfect here: O(1) add/remove, O(1) count, no duplicates.

    // TODO(human): Implement the three listener management methods below.
    // Each maps to a single Redis Set command on K.listeners(roomId):
    //   SADD  key member   → adds userId, returns 1 if added, 0 if already existed
    //   SREM  key member   → removes userId
    //   SCARD key          → returns the number of members (the listener count)
    //
    // Redis docs: https://redis.io/docs/latest/commands/?group=set

    async addRoomListener(roomId, userId) {
        await redis.sadd(K.listeners(roomId), userId);
    }

    async removeRoomListener(roomId, userId) {
        await redis.srem(K.listeners(roomId), userId);
    }

    async getListenerCount(roomId) {
        return redis.scard(K.listeners(roomId));
    }

    async getUsersInRoom(roomId) {
        return redis.smembers(K.listeners(roomId));
    }

    async isRoomAtCapacity(roomId) {
        const room = await this.getRoomById(roomId);
        if (!room) return false;
        const count = await this.getListenerCount(roomId);
        return count >= room.capacity;
    }

    // ── Playback State ───────────────────────────────────────────────────────

    async updateRoomPlaybackState(roomId, updates) {
        const fields = {};
        if (updates.currentSongId !== undefined)
            fields.currentSongId = updates.currentSongId ?? '';
        if (updates.currentSongPresignedUrl !== undefined)
            fields.currentSongPresignedUrl = updates.currentSongPresignedUrl ?? '';
        if (updates.isPlaying !== undefined)
            fields.isPlaying = updates.isPlaying ? '1' : '0';
        if (updates.startTimeUnix !== undefined)
            fields.startTimeUnix = String(updates.startTimeUnix ?? '');
        if (updates.pausedAtMs !== undefined)
            fields.pausedAtMs = String(updates.pausedAtMs ?? 0);
        if (Object.keys(fields).length > 0)
            await redis.hset(K.room(roomId), fields);
    }

    async getRoomPlaybackState(roomId) {
        // hmget fetches only the fields we need — faster than hgetall
        const [currentSongId, currentSongPresignedUrl, isPlaying, startTimeUnix, pausedAtMs] =
            await redis.hmget(K.room(roomId),
                'currentSongId', 'currentSongPresignedUrl', 'isPlaying', 'startTimeUnix', 'pausedAtMs');
        if (!currentSongId && !currentSongPresignedUrl) return null;
        return {
            currentSongId: currentSongId || null,
            currentSongPresignedUrl: currentSongPresignedUrl || null,
            isPlaying: isPlaying === '1',
            startTimeUnix: startTimeUnix ? Number(startTimeUnix) : null,
            pausedAtMs: Number(pausedAtMs ?? 0),
        };
    }

    // While playing: elapsed = now - startTimeUnix.
    // While paused:  position is frozen at pausedAtMs.
    async computeCurrentPositionMs(roomId) {
        const state = await this.getRoomPlaybackState(roomId);
        if (!state) return 0;
        if (!state.isPlaying) return state.pausedAtMs ?? 0;
        return Date.now() - (state.startTimeUnix ?? Date.now());
    }

    // ── Utility ──────────────────────────────────────────────────────────────

    // Pure function — no Redis needed, capacity is tier-derived
    getRoomCapacityByTier(tier) {
        const caps = { FREE: 10, PREMIUM: 50, CREATOR: Infinity };
        return caps[tier] ?? 10;
    }
}

export const socketManager = new SocketManager();
