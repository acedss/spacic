// Idempotency helpers — two layers, picked by purpose.
//
// 1. Redis SET-NX-EX (`once()`)  — short windows (≤ 5 min), fire-and-forget dedup.
//    Use this for socket events where a client may retry the same click.
//    The key is namespaced and self-expires; no audit trail.
//
// 2. Mongo IdempotencyKey (`withIdempotency()`) — persistent (24h+), audit-friendly.
//    Use this for money moves (admin gifts, manual credit adjustments, refunds)
//    where you need to *prove later* that "key X was already processed".
//    Stores the response payload so a retry returns the same result.
//
// Pick Redis for cheap dedup, Mongo for compliance-relevant ops.

import { redis } from './redis.js';
import { IdempotencyKey } from '../models/idempotencyKey.model.js';

/**
 * Returns true the FIRST time a key is seen within `ttlSec`.
 * On every subsequent call within the window, returns false.
 *
 * @param {string} scope  — namespace (e.g. 'vote', 'donate', 'fav-toggle')
 * @param {string} key    — client-supplied UUID or natural key
 * @param {number} ttlSec — dedup window (default 60s)
 */
export const once = async (scope, key, ttlSec = 60) => {
    if (!key) return true; // no key supplied → can't dedup; let through
    const fullKey = `idempotency:${scope}:${key}`;
    // SET key value NX EX ttlSec — atomic; returns 'OK' if newly set, null otherwise.
    const result = await redis.set(fullKey, '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
};

/**
 * Wraps an operation so a duplicate `key` returns the cached result instead
 * of re-executing. Stores the result on first success in Mongo with a TTL.
 *
 * @param {object}   opts
 * @param {string}   opts.key       — client-supplied unique key
 * @param {string}   opts.scope     — operation namespace (e.g. 'admin-gift')
 * @param {number}   opts.ttlHours  — how long to remember (default 24h)
 * @param {Function} opts.fn        — the operation; called only on first invocation
 * @returns whatever `fn()` returned (or the cached version on retry)
 */
export const withIdempotency = async ({ key, scope, ttlHours = 24, fn }) => {
    if (!key) throw new Error('idempotency key required');

    // Fast path: was this already processed?
    const existing = await IdempotencyKey.findOne({ key, scope }).lean();
    if (existing) return existing.result;

    // Race-safe insert. If two requests land at once, only one creates the row;
    // the loser hits a duplicate-key error and reads the winner's result.
    let placeholder;
    try {
        placeholder = await IdempotencyKey.create({
            key, scope,
            expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
        });
    } catch (err) {
        if (err.code === 11000) {
            // Another worker won the race — read the result they stored.
            const winner = await IdempotencyKey.findOne({ key, scope }).lean();
            return winner?.result;
        }
        throw err;
    }

    // We won the race; run the actual work and persist the result for replays.
    const result = await fn();
    placeholder.result = result;
    await placeholder.save();
    return result;
};
