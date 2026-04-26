/**
 * Stripe Webhook Signature — Unit Tests
 *
 * Acceptance Criteria:
 * AC-1: Missing STRIPE_WEBHOOK_SECRET throws before constructEvent is called
 * AC-2: constructEvent throwing results in "Invalid webhook signature" error
 * AC-3: Stripe not configured throws "Stripe is not configured"
 * AC-4: Unhandled event type returns undefined (no crash, no DB writes)
 * AC-5: Valid payment checkout.session.completed updates transaction + user balance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted before variable declarations — use vi.hoisted()
// to declare shared mock references that are safe to use inside factory functions.
const { mockConstructEvent, mockFindOneAndUpdate, mockUserUpdate } = vi.hoisted(() => ({
    mockConstructEvent:    vi.fn(),
    mockFindOneAndUpdate:  vi.fn(),
    mockUserUpdate:        vi.fn(),
}));

vi.mock('../lib/stripe.js', () => ({
    stripe: {
        webhooks:      { constructEvent: mockConstructEvent },
        subscriptions: { retrieve: vi.fn() },
    },
}));

vi.mock('../models/transaction.model.js', () => ({
    Transaction: { findOneAndUpdate: mockFindOneAndUpdate },
}));

vi.mock('../models/user.model.js', () => ({
    User: { findByIdAndUpdate: mockUserUpdate, findOne: vi.fn(), findById: vi.fn() },
}));

vi.mock('../lib/redis.js', () => ({
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}));

vi.mock('../models/topupPackage.model.js', () => ({
    TopupPackage: { find: vi.fn(), findOne: vi.fn() },
}));

vi.mock('../models/platformConfig.model.js', () => ({
    getConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('../models/room.model.js', () => ({
    Room: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
}));

vi.mock('mongoose', async () => {
    const { ObjectId } = await import('bson');
    return {
        default: {
            startSession: vi.fn(async () => ({
                withTransaction: async (fn) => fn(),
                endSession: vi.fn(),
            })),
            Types: { ObjectId },
        },
    };
});

import { handleWebhook } from '../services/wallet.service.js';

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
});

describe('AC-1: STRIPE_WEBHOOK_SECRET not set', () => {
    it('throws before calling constructEvent', async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;
        await expect(handleWebhook(Buffer.from('{}'), 'any-sig'))
            .rejects.toThrow('STRIPE_WEBHOOK_SECRET not set');
        expect(mockConstructEvent).not.toHaveBeenCalled();
    });
});

describe('AC-2: Invalid Stripe signature', () => {
    it('constructEvent throws → surfaces "Invalid webhook signature"', async () => {
        mockConstructEvent.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature');
        });
        await expect(handleWebhook(Buffer.from('{}'), 'bad-sig'))
            .rejects.toThrow('Invalid webhook signature');
    });

    it('any constructEvent error results in same message', async () => {
        mockConstructEvent.mockImplementation(() => { throw new Error('timestamp too old'); });
        await expect(handleWebhook(Buffer.from('{}'), 't=0,v1=bad'))
            .rejects.toThrow('Invalid webhook signature');
    });
});

describe('AC-4: Unhandled event type', () => {
    it('returns { received: true } without touching transaction or user tables', async () => {
        // Stripe best practice: always ACK all events; unknown types are silently ignored.
        mockConstructEvent.mockReturnValue({ type: 'payment_intent.created', data: { object: {} } });
        const result = await handleWebhook(Buffer.from('{}'), 'valid-sig');
        expect(result).toEqual({ received: true });
        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
    });
});

describe('AC-5: Valid payment checkout.session.completed', () => {
    it('updates transaction status then credits user balance', async () => {
        const fakeSession = {
            type: 'checkout.session.completed',
            data: {
                object: {
                    mode: 'payment',
                    metadata: { transactionId: 'txn-1', userId: 'user-1', credits: '500' },
                },
            },
        };
        mockConstructEvent.mockReturnValue(fakeSession);
        mockFindOneAndUpdate.mockResolvedValue({ _id: 'txn-1', status: 'completed' });

        const result = await handleWebhook(Buffer.from('{}'), 'valid-sig');

        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'txn-1', status: 'pending' },
            { $set: { status: 'completed' } },
            { new: true },
        );
        expect(mockUserUpdate).toHaveBeenCalledWith('user-1', { $inc: { balance: 500 } });
        expect(result).toEqual({ received: true });
    });

    it('is idempotent — second delivery (no pending txn) returns received:true without user update', async () => {
        const fakeSession = {
            type: 'checkout.session.completed',
            data: {
                object: {
                    mode: 'payment',
                    metadata: { transactionId: 'txn-2', userId: 'user-1', credits: '100' },
                },
            },
        };
        mockConstructEvent.mockReturnValue(fakeSession);
        mockFindOneAndUpdate.mockResolvedValue(null); // txn already completed

        const result = await handleWebhook(Buffer.from('{}'), 'valid-sig');
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(result).toEqual({ received: true });
    });
});
