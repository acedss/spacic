/**
 * Subscription Service — Unit Tests
 *
 * Acceptance Criteria:
 * AC-1: createSubscribeSession — empty slug throws 400
 * AC-2: createSubscribeSession — invalid billingCycle throws 400
 * AC-3: createSubscribeSession — plan not found throws 404
 * AC-4: createSubscribeSession — Stripe price not configured throws 400
 * AC-5: createSubscribeSession — user not found throws 404
 * AC-6: createSubscribeSession — happy path calls stripe.checkout.sessions.create
 * AC-7: getActivePlans — cold Redis cache queries DB and caches result
 * AC-8: getActivePlans — warm Redis cache skips DB entirely
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let redisStore = {};

vi.mock('../lib/redis.js', () => ({
    redis: {
        get: vi.fn(async (k) => redisStore[k] ?? null),
        set: vi.fn(async (k, v) => { redisStore[k] = v; }),
    },
}));

vi.mock('../lib/stripe.js', () => ({
    stripe: {
        checkout:      { sessions: { create: vi.fn() } },
        subscriptions: { retrieve: vi.fn() },
    },
}));

vi.mock('../models/subscriptionPlan.model.js', () => ({
    SubscriptionPlan: {
        findOne: vi.fn(),
        find:    vi.fn(),
    },
}));

vi.mock('../models/user.model.js', () => ({
    User: {
        findOne:           vi.fn(),
        findOneAndUpdate:  vi.fn(),
    },
}));

import { createSubscribeSession, getActivePlans } from '../services/subscription.service.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { User } from '../models/user.model.js';
import { redis } from '../lib/redis.js';
import { stripe } from '../lib/stripe.js';

beforeEach(() => {
    vi.clearAllMocks();
    redisStore = {};
    redis.get.mockImplementation(async (k) => redisStore[k] ?? null);
    redis.set.mockImplementation(async (k, v) => { redisStore[k] = v; });
});

// ── AC-1: slug validation ─────────────────────────────────────────────────────

describe('AC-1: slug is required', () => {
    it('empty string slug throws 400', async () => {
        const err = await createSubscribeSession('clerk-1', '', 'monthly', null).catch(e => e);
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/slug/i);
    });

    it('whitespace-only slug throws 400', async () => {
        const err = await createSubscribeSession('clerk-1', '   ', 'monthly', null).catch(e => e);
        expect(err.statusCode).toBe(400);
    });
});

// ── AC-2: billingCycle validation ─────────────────────────────────────────────

describe('AC-2: billingCycle must be "monthly" or "yearly"', () => {
    it('"weekly" billingCycle throws 400 before DB call', async () => {
        const err = await createSubscribeSession('clerk-1', 'premium', 'weekly', null).catch(e => e);
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/billingCycle/);
        expect(SubscriptionPlan.findOne).not.toHaveBeenCalled();
    });

    it('"annually" billingCycle throws 400', async () => {
        const err = await createSubscribeSession('clerk-1', 'premium', 'annually', null).catch(e => e);
        expect(err.statusCode).toBe(400);
    });

    it('"yearly" is accepted (no throw before plan lookup)', async () => {
        SubscriptionPlan.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
        const err = await createSubscribeSession('clerk-1', 'premium', 'yearly', null).catch(e => e);
        // Throws 404 for plan not found — billingCycle itself was valid
        expect(err.statusCode).toBe(404);
    });
});

// ── AC-3: plan not found ──────────────────────────────────────────────────────

describe('AC-3: plan not found', () => {
    it('throws 404 when plan slug does not exist', async () => {
        SubscriptionPlan.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
        const err = await createSubscribeSession('clerk-1', 'nonexistent', 'monthly', null).catch(e => e);
        expect(err.statusCode).toBe(404);
        expect(err.message).toMatch(/plan not found/i);
    });
});

// ── AC-4: Stripe price not configured ────────────────────────────────────────

describe('AC-4: Stripe price not configured for billing cycle', () => {
    it('monthly billing with no stripePriceIdMonthly throws 400', async () => {
        SubscriptionPlan.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                slug: 'premium', tier: 'PREMIUM',
                stripePriceIdMonthly: null,
                stripePriceIdYearly:  null,
                isActive: true,
            }),
        });
        const err = await createSubscribeSession('clerk-1', 'premium', 'monthly', null).catch(e => e);
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/not yet available/i);
    });

    it('yearly billing with no stripePriceIdYearly throws 400', async () => {
        SubscriptionPlan.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                slug: 'premium', tier: 'PREMIUM',
                stripePriceIdMonthly: 'price_monthly',
                stripePriceIdYearly:  null,
                isActive: true,
            }),
        });
        const err = await createSubscribeSession('clerk-1', 'premium', 'yearly', null).catch(e => e);
        expect(err.statusCode).toBe(400);
    });
});

// ── AC-5: user not found ──────────────────────────────────────────────────────

describe('AC-5: user not found after plan lookup', () => {
    it('throws 404 when user does not exist', async () => {
        SubscriptionPlan.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                slug: 'premium', tier: 'PREMIUM',
                stripePriceIdMonthly: 'price_monthly_1',
                stripePriceIdYearly:  null,
                isActive: true,
            }),
        });
        User.findOne.mockResolvedValue(null);
        const err = await createSubscribeSession('clerk-ghost', 'premium', 'monthly', null).catch(e => e);
        expect(err.statusCode).toBe(404);
        expect(err.message).toMatch(/user not found/i);
    });
});

// ── AC-6: happy path ──────────────────────────────────────────────────────────

describe('AC-6: happy path creates checkout session', () => {
    it('calls stripe.checkout.sessions.create and returns URL', async () => {
        SubscriptionPlan.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                slug: 'premium', tier: 'PREMIUM',
                stripePriceIdMonthly: 'price_monthly_123',
                isActive: true,
            }),
        });
        User.findOne.mockResolvedValue({ _id: 'user-1', clerkId: 'clerk-1' });
        stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session_abc' });

        const result = await createSubscribeSession('clerk-1', 'premium', 'monthly', 'http://localhost:5173');
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                line_items: [{ price: 'price_monthly_123', quantity: 1 }],
                metadata: expect.objectContaining({ tier: 'PREMIUM' }),
            }),
        );
        expect(result.url).toBe('https://checkout.stripe.com/session_abc');
    });
});

// ── AC-7 & AC-8: getActivePlans caching ──────────────────────────────────────

describe('getActivePlans Redis caching', () => {
    it('AC-7: cold cache queries DB and stores result', async () => {
        const plans = [{
            slug: 'free', name: 'Free', tier: 'FREE',
            priceMonthlyUsd: 0, priceYearlyUsd: 0,
            features: [], roomCapacity: 10, sortOrder: 0,
            stripePriceIdMonthly: null, stripePriceIdYearly: null,
        }];
        SubscriptionPlan.find.mockReturnValue({
            sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(plans) }),
        });

        const result = await getActivePlans();

        expect(SubscriptionPlan.find).toHaveBeenCalledOnce();
        expect(redis.set).toHaveBeenCalledOnce();
        expect(result).toHaveLength(1);
        expect(result[0].slug).toBe('free');
    });

    it('AC-8: warm Redis cache skips DB entirely', async () => {
        const cached = [{ slug: 'premium', name: 'Premium' }];
        redis.get.mockResolvedValue(JSON.stringify(cached));

        const result = await getActivePlans();

        expect(SubscriptionPlan.find).not.toHaveBeenCalled();
        expect(result).toEqual(cached);
    });

    it('AC-8b: cached result is returned verbatim (no re-transformation)', async () => {
        const cached = [{ slug: 'creator', canSubscribeMonthly: true, canSubscribeYearly: false }];
        redis.get.mockResolvedValue(JSON.stringify(cached));

        const result = await getActivePlans();
        expect(result[0].canSubscribeMonthly).toBe(true);
    });
});
