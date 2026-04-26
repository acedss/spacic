/**
 * Auth Middleware — Unit Tests
 *
 * Acceptance Criteria:
 * AC-1: Dev bypass token (non-production) sets devBypass and calls next()
 * AC-2: Wrong dev token falls through to Clerk auth check → 401 if userId absent
 * AC-3: Missing userId (falsy) returns 401
 * AC-4: Valid Clerk userId calls next()
 * AC-5: requireAdmin — non-admin user returns 403
 * AC-6: requireAdmin — ADMIN role calls next()
 * AC-7: requireAdmin — user not in DB returns 404
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/user.model.js', () => ({
    User: { findOne: vi.fn() },
}));

vi.mock('@clerk/express', () => ({
    clerkClient: {
        users: { getUser: vi.fn() },
    },
}));

import { protectRoute, requireAdmin } from '../middlewares/auth.middleware.js';
import { User } from '../models/user.model.js';
import { clerkClient } from '@clerk/express';

const mockRes = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json   = vi.fn(() => res);
    return res;
};

describe('protectRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NODE_ENV        = 'test';
        process.env.DEV_BYPASS_TOKEN = 'spacic-dev-2026';
        process.env.DEV_CLERK_ID    = 'clerk-dev-1';
    });

    it('AC-1: dev bypass token accepted in non-production', async () => {
        const next = vi.fn();
        const req  = { headers: { 'x-dev-token': 'spacic-dev-2026' }, auth: vi.fn() };
        await protectRoute(req, mockRes(), next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.devBypass).toBe(true);
        expect(req.devClerkId).toBe('clerk-dev-1');
    });

    it('AC-2: wrong dev token ignored → falls to auth check → 401 when userId absent', async () => {
        const next = vi.fn();
        const req  = {
            headers: { 'x-dev-token': 'wrong-token' },
            auth: vi.fn().mockReturnValue({ userId: null }),
        };
        const res = mockRes();
        await protectRoute(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('AC-3: missing x-dev-token header + null userId → 401', async () => {
        const next = vi.fn();
        const req  = { headers: {}, auth: vi.fn().mockReturnValue({ userId: null }) };
        const res  = mockRes();
        await protectRoute(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Unauthorized') }));
    });

    it('AC-4: valid Clerk userId calls next()', async () => {
        const next = vi.fn();
        const req  = { headers: {}, auth: vi.fn().mockReturnValue({ userId: 'user_abc123' }) };
        await protectRoute(req, mockRes(), next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('AC-4b: dev token disabled in production → falls to Clerk check', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const next = vi.fn();
        const req  = {
            headers: { 'x-dev-token': 'spacic-dev-2026' },
            auth: vi.fn().mockReturnValue({ userId: 'user_real' }),
        };
        await protectRoute(req, mockRes(), next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.devBypass).toBeUndefined();
        process.env.NODE_ENV = originalEnv;
    });
});

describe('requireAdmin', () => {
    beforeEach(() => vi.clearAllMocks());

    it('AC-5: non-admin user returns 403', async () => {
        clerkClient.users.getUser.mockResolvedValue({ id: 'clerk-1' });
        User.findOne.mockResolvedValue({ clerkId: 'clerk-1', role: 'USER' });
        const next = vi.fn();
        const req  = { auth: vi.fn().mockReturnValue({ userId: 'clerk-1' }) };
        const res  = mockRes();
        await requireAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('AC-6: ADMIN role calls next()', async () => {
        clerkClient.users.getUser.mockResolvedValue({ id: 'clerk-1' });
        User.findOne.mockResolvedValue({ clerkId: 'clerk-1', role: 'ADMIN' });
        const next = vi.fn();
        const req  = { auth: vi.fn().mockReturnValue({ userId: 'clerk-1' }) };
        await requireAdmin(req, mockRes(), next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('AC-7: user not found in DB returns 404', async () => {
        clerkClient.users.getUser.mockResolvedValue({ id: 'clerk-ghost' });
        User.findOne.mockResolvedValue(null);
        const next = vi.fn();
        const req  = { auth: vi.fn().mockReturnValue({ userId: 'clerk-ghost' }) };
        const res  = mockRes();
        await requireAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    });
});
