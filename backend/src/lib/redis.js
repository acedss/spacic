// Redis client — single connection for all HSET/SADD/HMGET/GET/SET operations.
//
// Pub/Sub clients (for @socket.io/redis-adapter) are NOT created here.
// The adapter is only needed for horizontal scaling (multiple Node processes).
// Until then, Socket.IO's built-in in-memory adapter handles all broadcasts.

import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(url, {
    // Fail individual commands after 3 retries instead of hanging forever.
    // Without this, a Redis outage causes every request touching Redis to stall
    // until the operation times out (ioredis default: unlimited retries).
    maxRetriesPerRequest: 3,
    // Give up on the initial TCP handshake after 5 s rather than the default 10 s.
    connectTimeout: 5000,
});

redis.on('connect',     () => console.log('[Redis] connected'));
redis.on('error',       (err) => console.error('[Redis] error:', err.message));
redis.on('close',       () => console.log('[Redis] connection closed'));
redis.on('reconnecting', () => console.log('[Redis] reconnecting...'));
