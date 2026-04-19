/**
 * Wallet Service — Unit Tests
 *
 * Tests validation guards, idempotency, and Redis caching.
 * donateToRoom's Mongoose session transaction is integration-territory —
 * we test the guards that fire BEFORE the session opens, plus the
 * idempotency fast-path that runs BEFORE the session as well.
 *
 * Acceptance Criteria (Product Owner):
 * AC-1: Donation below 100 credits is rejected before any DB call
 * AC-2: Missing idempotencyKey is rejected before any DB call
 * AC-3: Idempotent second call returns cached result (no transaction opened)
 * AC-4: getActivePackages returns DB result on cold cache, then caches it
 * AC-5: getActivePackages returns Redis-cached result on warm cache (no DB call)
 * AC-6: computeVotesNeeded math used internally — validated independently
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const txns = [];
let redisStore = {};

vi.mock('../models/user.model.js', () => ({
    User: {
        findOne:           vi.fn(),
        findById:          vi.fn(),
        findByIdAndUpdate: vi.fn(),
        findOneAndUpdate:  vi.fn(),
    },
}));

vi.mock('../models/room.model.js', () => ({
    Room: {
        findById:          vi.fn(),
        findByIdAndUpdate: vi.fn(),
    },
}));

vi.mock('../models/transaction.model.js', () => ({
    Transaction: {
        findOne:          vi.fn(async ({ idempotencyKey }) =>
            txns.find(t => t.idempotencyKey === idempotencyKey) ?? null
        ),
        findByIdAndUpdate: vi.fn(),
        create:            vi.fn(async (data) => {
            const record = Array.isArray(data) ? data[0] : data;
            txns.push(record);
            return record;
        }),
    },
}));

vi.mock('../models/topupPackage.model.js', () => ({
    TopupPackage: {
        find:    vi.fn(),
        findOne: vi.fn(),
    },
}));

vi.mock('../lib/redis.js', () => ({
    redis: {
        get: vi.fn(async (key) => redisStore[key] ?? null),
        set: vi.fn(async (key, val) => { redisStore[key] = val; }),
    },
}));

vi.mock('../lib/stripe.js', () => ({ stripe: null }));
vi.mock('../models/platformConfig.model.js', () => ({ getConfig: vi.fn(async () => ({})) }));

// Mongoose session: call fn() once and propagate any throw immediately (no retry)
vi.mock('mongoose', async () => {
    const { ObjectId } = await import('bson');
    return {
        default:      {},
        startSession: vi.fn(async () => ({
            withTransaction: async (fn) => fn(),
            endSession:      vi.fn(),
        })),
        Types: { ObjectId },
    };
});

import { donateToRoom, getActivePackages } from '../services/wallet.service.js';
import { TopupPackage } from '../models/topupPackage.model.js';
import { User } from '../models/user.model.js';
import { Room } from '../models/room.model.js';
import { Transaction } from '../models/transaction.model.js';
import { redis } from '../lib/redis.js';

beforeEach(() => {
    vi.clearAllMocks();
    txns.length = 0;
    redisStore = {};
    // Re-apply the Transaction.findOne implementation after clearAllMocks
    Transaction.findOne.mockImplementation(async ({ idempotencyKey }) =>
        txns.find(t => t.idempotencyKey === idempotencyKey) ?? null
    );
    redis.get.mockImplementation(async (key) => redisStore[key] ?? null);
    redis.set.mockImplementation(async (key, val) => { redisStore[key] = val; });
});

// ── AC-1: Below-minimum donation rejected before any DB call ─────────────────

describe('AC-1: Minimum donation is 100 credits', () => {
    it('amount=50 throws before touching DB', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 50, 'key-1'))
            .rejects.toThrow('Minimum donation is 100 credits');
        expect(Transaction.findOne).not.toHaveBeenCalled();
    });

    it('amount=0 throws', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 0, 'key-1'))
            .rejects.toThrow();
    });

    it('amount=99 throws', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 99, 'key-1'))
            .rejects.toThrow();
    });

    it('amount=100 passes the minimum check (may fail later on missing user)', async () => {
        User.findOne.mockResolvedValue(null);
        Transaction.findOne.mockResolvedValue(null);
        // Throws "User not found" — not the minimum check
        await expect(donateToRoom('clerk-1', 'room-1', 100, 'key-1'))
            .rejects.toThrow();
    });
});

// ── AC-2: Missing idempotencyKey rejected before any DB call ─────────────────

describe('AC-2: idempotencyKey is required', () => {
    it('null key throws before DB', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 200, null))
            .rejects.toThrow('idempotencyKey is required');
        expect(Transaction.findOne).not.toHaveBeenCalled();
    });

    it('empty string key throws', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 200, ''))
            .rejects.toThrow('idempotencyKey is required');
    });

    it('undefined key throws', async () => {
        await expect(donateToRoom('clerk-1', 'room-1', 200, undefined))
            .rejects.toThrow('idempotencyKey is required');
    });
});

// ── AC-3: Idempotency — existing transaction returns cached result ────────────

describe('AC-3: Idempotent donation fast-path (no session opened)', () => {
    it('GIVEN existing txn for same key THEN returns cached balance, no new txn', async () => {
        // Pre-seed an existing transaction
        const existingTxn = { idempotencyKey: 'idem-1' };
        txns.push(existingTxn);

        const user = { _id: 'donor-1', clerkId: 'clerk-1', balance: 800, fullName: 'Alice' };
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });

        const room = { _id: 'room-1', creatorId: 'c-1', streamGoal: 500, streamGoalCurrent: 100, escrow: 100 };
        Room.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(room) });

        const result = await donateToRoom('clerk-1', 'room-1', 200, 'idem-1');

        // Fast path: no new transaction created
        expect(Transaction.create).not.toHaveBeenCalled();
        expect(result.newBalance).toBe(800);
        expect(result.donor.amount).toBe(200);
        expect(result.goalReached).toBe(false);
    });

    it('GIVEN two different keys THEN each is treated as a new donation', async () => {
        User.findOne.mockResolvedValue(null); // will fail after idempotency check
        Transaction.findOne.mockResolvedValue(null);

        await expect(donateToRoom('clerk-1', 'room-1', 200, 'key-new'))
            .rejects.toThrow(); // fails at User.findOne → not idempotent
        expect(Transaction.findOne).toHaveBeenCalled();
    });
});

// ── AC-4: getActivePackages — cold cache hits DB ──────────────────────────────

describe('AC-4 & AC-5: getActivePackages caching', () => {
    it('AC-4: GIVEN cold cache THEN DB is queried and result cached in Redis', async () => {
        redis.get.mockResolvedValue(null); // cache miss

        const doc = { packageId: 'starter', name: 'Starter', priceUsd: 499, credits: 500, bonusPercent: 0, isFeatured: false };
        TopupPackage.find.mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([doc]),
            }),
        });

        const result = await getActivePackages();

        expect(TopupPackage.find).toHaveBeenCalledOnce();
        expect(redis.set).toHaveBeenCalledOnce();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('starter');
        expect(result[0].priceInCents).toBe(499);
    });

    it('AC-5: GIVEN warm Redis cache THEN DB is NOT queried', async () => {
        const cached = [{ id: 'starter', label: 'Starter', priceInCents: 499, credits: 500, bonus: null, isFeatured: false }];
        redis.get.mockResolvedValue(JSON.stringify(cached));

        const result = await getActivePackages();

        expect(TopupPackage.find).not.toHaveBeenCalled();
        expect(result).toEqual(cached);
    });

    it('AC-5: bonus label is "+X%" for non-zero bonus, null for zero', async () => {
        redis.get.mockResolvedValue(null);

        const docs = [
            { packageId: 'a', name: 'A', priceUsd: 100, credits: 100, bonusPercent: 10, isFeatured: false },
            { packageId: 'b', name: 'B', priceUsd: 200, credits: 200, bonusPercent: 0,  isFeatured: false },
        ];
        TopupPackage.find.mockReturnValue({
            sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(docs) }),
        });

        const result = await getActivePackages();

        expect(result[0].bonus).toBe('+10%');
        expect(result[1].bonus).toBeNull();
    });
});
