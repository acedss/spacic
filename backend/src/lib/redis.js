// Redis client setup
// Main client for general commands (HSET, HGETALL, SADD, etc.)
// Pub/Sub clients are only created in production for Socket.IO Redis Adapter.
// In dev (single-process), the default in-memory adapter is used, so pub/sub
// connections are unnecessary and their creation can mask errors.

import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(url);

// Pub/Sub clients: only needed for multi-instance production deployments
const isProduction = process.env.NODE_ENV === 'production';
export const redisPub = isProduction ? new Redis(url) : null;
export const redisSub = isProduction ? new Redis(url) : null;

redis.on('error', (err) => console.error('[Redis] client error:', err));
if (redisPub) redisPub.on('error', (err) => console.error('[Redis] pub error:', err));
if (redisSub) redisSub.on('error', (err) => console.error('[Redis] sub error:', err));

console.log(`[Redis] main client connected | pub/sub: ${isProduction ? 'enabled' : 'skipped (dev)'}`);
