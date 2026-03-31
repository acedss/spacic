// Redis-backed state manager for Socket.IO
//
// Key schema:
//   room:{roomId}              → HASH   (metadata + playback anchor)
//   room:{roomId}:listeners    → SET    (active listener userId strings)
//   room:{roomId}:playlist     → STRING (JSON array — cached playlist)
//   user:socket:{socketId}     → HASH   (session per socket connection, 24h TTL)
//   user:clerk:{clerkId}       → HASH   (cached user data, 1h TTL)
//
// Design principles:
//   - Store S3 keys, not presigned URLs (URLs expire in 5 min; keys are permanent)
//   - Cache user data by clerkId so User.findOne() is skipped on repeat events
//   - Cache playlists so Room.populate() is skipped on every skip/song-end

import { redis } from './redis.js';

const K = {
    room:      (id)      => `room:${id}`,
    listeners: (id)      => `room:${id}:listeners`,
    socket:    (id)      => `user:socket:${id}`,
    playlist:  (id)      => `room:${id}:playlist`,
    userClerk: (clerkId) => `user:clerk:${clerkId}`,
};

const USER_TTL_S       = 86_400; // 24h — socket sessions auto-expire after crash
const USER_CACHE_TTL_S =  3_600; // 1h  — user data cache (invalidate on profile change)
const PLAYLIST_TTL_S   =  3_600; // 1h  — playlist cache (refreshed on new song append)

class SocketManager {

    // ── User Sessions (per socket connection) ────────────────────────────────

    async addUserSession(socketId, userData) {
        await redis.hset(K.socket(socketId), {
            userId:       userData.userId,
            clerkId:      userData.clerkId,
            userName:     userData.userName  || '',
            userImage:    userData.userImage || '',
            userTier:     userData.userTier  || 'FREE',
            role:         userData.role      || 'USER',
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

    // ── User Data Cache (by clerkId) ─────────────────────────────────────────
    // Persists across reconnects — keyed by clerkId, not socket.id.
    // Avoids User.findOne() on room:join, room:leave, room:creator_reconnect.

    async cacheUser(clerkId, userData) {
        await redis.hset(K.userClerk(clerkId), {
            userId:   userData.userId,
            fullName: userData.fullName || '',
            imageUrl: userData.imageUrl || '',
            role:     userData.role     || 'USER',
            userTier: userData.userTier || 'FREE',
        });
        await redis.expire(K.userClerk(clerkId), USER_CACHE_TTL_S);
    }

    async getCachedUser(clerkId) {
        const data = await redis.hgetall(K.userClerk(clerkId));
        if (!data || !data.userId) return null;
        return data;
    }

    // ── Room Sessions ────────────────────────────────────────────────────────

    async addRoomSession(roomId, roomData) {
        await redis.hset(K.room(roomId), {
            creatorId:       roomData.creatorId,
            title:           roomData.title           || '',
            capacity:        String(roomData.capacity ?? 10),
            currentSongId:   roomData.currentSongId   || '',
            currentSongS3Key: roomData.currentSongS3Key || '', // key only — URL generated fresh on join
            startTimeUnix:   String(roomData.startTimeUnix ?? ''),
            pausedAtMs:      String(roomData.pausedAtMs    ?? 0),
            isPlaying:       roomData.isPlaying ? '1' : '0',
        });
        return this.getRoomById(roomId);
    }

    async getRoomById(roomId) {
        const data = await redis.hgetall(K.room(roomId));
        if (!data || !data.creatorId) return null;
        const listenerCount = await this.getListenerCount(roomId);
        return {
            creatorId:        data.creatorId,
            title:            data.title,
            capacity:         Number(data.capacity),
            currentSongId:    data.currentSongId    || null,
            currentSongS3Key: data.currentSongS3Key || null,
            startTimeUnix:    data.startTimeUnix ? Number(data.startTimeUnix) : null,
            pausedAtMs:       Number(data.pausedAtMs ?? 0),
            isPlaying:        data.isPlaying === '1',
            listenerCount,
        };
    }

    async removeRoomSession(roomId) {
        // Delete room hash, listeners set, and playlist cache in one call
        await redis.del(K.room(roomId), K.listeners(roomId), K.playlist(roomId));
    }

    // ── Listener Management ──────────────────────────────────────────────────
    // Redis SETs: O(1) add/remove, O(1) count, no duplicates.

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
        // listenerCount is already fetched inside getRoomById — no extra round-trip
        return room.listenerCount >= room.capacity;
    }

    // ── Playlist Cache ───────────────────────────────────────────────────────
    // Avoids Room.findById().populate('playlist') on every skip/song-end.
    // Cache is refreshed (not invalidated) when a random song is appended.

    async cacheRoomPlaylist(roomId, songs) {
        await redis.set(K.playlist(roomId), JSON.stringify(songs), 'EX', PLAYLIST_TTL_S);
    }

    async getCachedPlaylist(roomId) {
        const data = await redis.get(K.playlist(roomId));
        return data ? JSON.parse(data) : null;
    }

    // ── Playback State ───────────────────────────────────────────────────────

    async updateRoomPlaybackState(roomId, updates) {
        const fields = {};
        if (updates.currentSongId   !== undefined) fields.currentSongId   = updates.currentSongId   ?? '';
        if (updates.currentSongS3Key !== undefined) fields.currentSongS3Key = updates.currentSongS3Key ?? '';
        if (updates.isPlaying        !== undefined) fields.isPlaying        = updates.isPlaying ? '1' : '0';
        if (updates.startTimeUnix    !== undefined) fields.startTimeUnix    = String(updates.startTimeUnix ?? '');
        if (updates.pausedAtMs       !== undefined) fields.pausedAtMs       = String(updates.pausedAtMs    ?? 0);
        if (Object.keys(fields).length > 0) await redis.hset(K.room(roomId), fields);
    }

    async getRoomPlaybackState(roomId) {
        // hmget fetches only the 5 fields we need — faster than hgetall on large hashes
        const [currentSongId, currentSongS3Key, isPlaying, startTimeUnix, pausedAtMs] =
            await redis.hmget(K.room(roomId),
                'currentSongId', 'currentSongS3Key', 'isPlaying', 'startTimeUnix', 'pausedAtMs');
        if (!currentSongId) return null;
        return {
            currentSongId:    currentSongId    || null,
            currentSongS3Key: currentSongS3Key || null,
            isPlaying:        isPlaying === '1',
            startTimeUnix:    startTimeUnix ? Number(startTimeUnix) : null,
            pausedAtMs:       Number(pausedAtMs ?? 0),
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

    getRoomCapacityByTier(tier) {
        const caps = { FREE: 10, PREMIUM: 50, CREATOR: Infinity };
        return caps[tier] ?? 10;
    }
}

export const socketManager = new SocketManager();
