import { redis } from './redis.js';

// Redis sliding-window rate limiter for Socket.IO events.
// Uses INCR + EXPIRE: first increment sets the window; subsequent increments
// within the window check against the limit.
//
// Returns true  → request allowed
// Returns false → rate limit exceeded
//
// key format: socket_rl:{userId}:{event}:{roomId?}
// Example limits used in socket.js:
//   chat        — 10 per 10s per user per room
//   nominate    — 3  per 30s per user per room
//   donate      — 5  per 60s per user (room-scoped to prevent sock-puppet spam)
export const socketRateLimit = async (userId, event, { limit, windowSec, roomId = '' }) => {
    const key = `socket_rl:${userId}:${event}:${roomId}`;
    try {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        return count <= limit;
    } catch {
        return true; // fail open — don't block on Redis errors
    }
};
