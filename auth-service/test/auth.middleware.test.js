import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdmin } from '../src/middlewares/auth.middleware.js';
import { clerkClient, getAuth } from '@clerk/express';
import { User } from '../src/models/user.model.js';

// Mock the dependencies
vi.mock('@clerk/express', () => ({
    getAuth: vi.fn(),
    clerkClient: {
        users: {
            getUser: vi.fn(),
        },
    },
}));

vi.mock('../src/models/user.model.js', () => ({
    User: {
        findOne: vi.fn(),
    },
}));

describe('requireAdmin middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    it('should call next() if the user has the ADMIN role', async () => {
        // Setup mocks
        getAuth.mockReturnValue({ userId: 'user_admin_123' });
        clerkClient.users.getUser.mockResolvedValue({ id: 'user_admin_123' });

        // Mock User.findOne().lean()
        const mockLean = vi.fn().mockResolvedValue({ clerkId: 'user_admin_123', role: 'ADMIN' });
        User.findOne.mockReturnValue({ lean: mockLean });

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        expect(req.dbUser).toBeDefined();
        expect(req.dbUser.role).toBe('ADMIN');
    });

    it('should return 403 if the user is not an ADMIN', async () => {
        getAuth.mockReturnValue({ userId: 'user_regular_123' });
        clerkClient.users.getUser.mockResolvedValue({ id: 'user_regular_123' });

        const mockLean = vi.fn().mockResolvedValue({ clerkId: 'user_regular_123', role: 'USER' });
        User.findOne.mockReturnValue({ lean: mockLean });

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized - admin only' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if the user is not found in the database', async () => {
        getAuth.mockReturnValue({ userId: 'user_not_found' });
        clerkClient.users.getUser.mockResolvedValue({ id: 'user_not_found' });

        const mockLean = vi.fn().mockResolvedValue(null);
        User.findOne.mockReturnValue({ lean: mockLean });

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should call next(error) if an error occurs', async () => {
        const error = new Error('Clerk error');
        getAuth.mockImplementation(() => { throw error; });

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
