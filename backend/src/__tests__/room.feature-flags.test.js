/**
 * Room Feature Flags — Unit Tests
 *
 * Tests the updateFeatureFlags controller: whitelist enforcement,
 * 404 guards, and response shape.
 *
 * Acceptance Criteria:
 * AC-1: Only boolean values for whitelisted keys are persisted
 * AC-2: Non-whitelisted keys in body are silently dropped
 * AC-3: Returns 404 if user not found
 * AC-4: Returns 404 if room not found
 * AC-5: Returns 200 with updated featureFlags on success
 * AC-6: Offline room does not emit socket event
 * AC-7: Live room emits room:flags_updated to socket
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../models/user.model.js', () => ({
    User: { findOne: vi.fn() },
}));

vi.mock('../models/room.model.js', () => ({
    Room: { findOneAndUpdate: vi.fn() },
}));

const mockEmit = vi.fn();
const mockTo   = vi.fn(() => ({ emit: mockEmit }));

vi.mock('../lib/io.js', () => ({
    getIo: vi.fn(() => ({ to: mockTo })),
}));

// Intercept the dynamic import used for cache invalidation
vi.mock('../lib/socket.js', () => ({
    invalidateFeatureFlagsCache: vi.fn(),
    initializeSocket: vi.fn(),
    default: vi.fn(),
}));

vi.mock('../services/room.service.js', () => ({}));

vi.mock('../services/s3.services.js', () => ({
    putObject:       vi.fn(),
    getPresignedUrl: vi.fn(),
}));

import { updateFeatureFlags } from '../controllers/room.controller.js';
import { User } from '../models/user.model.js';
import { Room } from '../models/room.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockRes = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json   = vi.fn(() => res);
    return res;
};

const makeReq = (body) => ({
    body,
    devBypass:  true,
    devClerkId: 'clerk-1',
    headers:    {},
    auth:       vi.fn(),
});

beforeEach(() => vi.clearAllMocks());

// ── AC-1 & AC-2: whitelist enforcement ───────────────────────────────────────

describe('AC-1 & AC-2: key whitelist is enforced', () => {
    it('only boolean values for allowed keys are written to DB', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        const updatedFlags = { liveMic: false, chat: true, donations: true, voting: true, minigames: true, voteQueue: true, broadcasts: true };
        Room.findOneAndUpdate.mockResolvedValue({
            _id: 'room-1',
            status: 'offline',
            featureFlags: updatedFlags,
        });

        const req = makeReq({ liveMic: false, chat: true, unknownProp: 'malicious' });
        await updateFeatureFlags(req, mockRes(), vi.fn());

        const updateArg = Room.findOneAndUpdate.mock.calls[0][1];
        expect(updateArg.$set['featureFlags.liveMic']).toBe(false);
        expect(updateArg.$set['featureFlags.chat']).toBe(true);
        expect(updateArg.$set['featureFlags.unknownProp']).toBeUndefined();
    });

    it('AC-2: non-boolean values are dropped even for allowed keys', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        const updatedFlags = { chat: true };
        Room.findOneAndUpdate.mockResolvedValue({ _id: 'room-1', status: 'offline', featureFlags: updatedFlags });

        const req = makeReq({ chat: 'yes', liveMic: 1, voting: null });
        await updateFeatureFlags(req, mockRes(), vi.fn());

        const updateArg = Room.findOneAndUpdate.mock.calls[0][1];
        expect(Object.keys(updateArg.$set)).toHaveLength(0);
    });
});

// ── AC-3: user not found ──────────────────────────────────────────────────────

describe('AC-3: user not found', () => {
    it('returns 404 without touching Room', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
        const res = mockRes();
        await updateFeatureFlags(makeReq({ chat: false }), res, vi.fn());
        expect(res.status).toHaveBeenCalledWith(404);
        expect(Room.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

// ── AC-4: room not found ──────────────────────────────────────────────────────

describe('AC-4: room not found', () => {
    it('returns 404', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        Room.findOneAndUpdate.mockResolvedValue(null);
        const res = mockRes();
        await updateFeatureFlags(makeReq({ chat: false }), res, vi.fn());
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ── AC-5: success shape ───────────────────────────────────────────────────────

describe('AC-5: success response', () => {
    it('returns { success: true, data: featureFlags }', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        const featureFlags = { liveMic: false, chat: true, donations: true, voting: true, minigames: true, voteQueue: true, broadcasts: true };
        Room.findOneAndUpdate.mockResolvedValue({ _id: 'room-1', status: 'offline', featureFlags });

        const res = mockRes();
        await updateFeatureFlags(makeReq({ liveMic: false }), res, vi.fn());

        expect(res.json).toHaveBeenCalledWith({ success: true, data: featureFlags });
    });
});

// ── AC-6: offline room — no socket emit ──────────────────────────────────────

describe('AC-6: offline room does not emit socket event', () => {
    it('io.to() is not called when room is offline', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        Room.findOneAndUpdate.mockResolvedValue({ _id: 'room-1', status: 'offline', featureFlags: {} });

        await updateFeatureFlags(makeReq({ chat: false }), mockRes(), vi.fn());
        expect(mockTo).not.toHaveBeenCalled();
    });
});

// ── AC-7: live room emits socket event ───────────────────────────────────────

describe('AC-7: live room broadcasts room:flags_updated', () => {
    it('emits event to room channel with updated flags', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        const featureFlags = { chat: false };
        Room.findOneAndUpdate.mockResolvedValue({ _id: 'room-1', status: 'live', featureFlags });

        await updateFeatureFlags(makeReq({ chat: false }), mockRes(), vi.fn());

        expect(mockTo).toHaveBeenCalledWith('room-1');
        expect(mockEmit).toHaveBeenCalledWith('room:flags_updated', { featureFlags });
    });
});
