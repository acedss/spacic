// Redis client — single connection for all HSET/SADD/HMGET/GET/SET operations.
//
// Pub/Sub clients (for @socket.io/redis-adapter) are NOT created here.
// The adapter is only needed for horizontal scaling (multiple Node processes).
// Until then, Socket.IO's built-in in-memory adapter handles all broadcasts.

import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(url);

redis.on('connect', () => console.log('[Redis] connected'));
redis.on('error', (err) => console.error('[Redis] error:', err.message));
