import { redis } from '../lib/redis.js';

// Idempotency middleware for non-idempotent POST endpoints.
//
// Clients send `Idempotency-Key: <uuid>` with their request.
// If the same (userId, key) pair is seen within `ttlSeconds`, the cached
// response is returned immediately — no duplicate Stripe session or withdrawal.
//
// Key scope is always tied to the authenticated user, so two different users
// sending the same UUID do not collide.
//
// Usage: router.post('/subscribe', protectRoute, idempotency(), validate(...), controller)
//
export const idempotency = (ttlSeconds = 86_400) => async (req, res, next) => {
    const clientKey = req.headers['idempotency-key'];
    if (!clientKey) return next();

    // Clerk userId is available after protectRoute runs
    const userId = req.devBypass ? req.devClerkId : req.auth?.()?.userId;
    if (!userId) return next();

    const redisKey = `idempotency:${userId}:${clientKey}`;

    try {
        const cached = await redis.get(redisKey);
        if (cached) {
            res.setHeader('Idempotency-Replayed', 'true');
            return res.status(200).json(JSON.parse(cached));
        }
    } catch { /* Redis miss — fall through to normal handler */ }

    // Intercept res.json so we can cache the first successful response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode < 400) {
            redis.set(redisKey, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
        }
        return originalJson(body);
    };

    next();
};
