/**
 * Room Service — Unit Tests
 *
 * Covers: goLive ownership/state guards, joinRoom capacity + live-state guards,
 * getPublicRooms query construction, getCreatorRoomAnalytics input validation.
 *
 * Acceptance Criteria:
 * AC-1:  goLive — room not found throws
 * AC-2:  goLive — non-creator throws
 * AC-3:  goLive — already-live room throws
 * AC-4:  joinRoom — offline room throws
 * AC-5:  joinRoom — full room throws
 * AC-6:  getPublicRooms — search term wired to $regex query
 * AC-7:  getPublicRooms — single tag uses exact match
 * AC-8:  getPublicRooms — multiple comma-sep tags use $in
 * AC-9:  getPublicRooms — limit capped at 100
 * AC-10: getPublicRooms — status:"live" filter applied
 * AC-11: getCreatorRoomAnalytics — from >= to throws 400
 * AC-12: getCreatorRoomAnalytics — range > 366 days throws 400
 * AC-13: getCreatorRoomAnalytics — user not found throws 404
 * AC-14: getCreatorRoomAnalytics — no room returns empty summary shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
        Types: { ObjectId },
    };
});

vi.mock('../models/room.model.js', () => ({
    Room: {
        findById:          vi.fn(),
        findByIdAndUpdate: vi.fn(),
        findOne:           vi.fn(),
        find:              vi.fn(),
        countDocuments:    vi.fn().mockResolvedValue(0),
        aggregate:         vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('../models/user.model.js', () => ({
    User: {
        findOne:           vi.fn(),
        findById:          vi.fn(),
        findByIdAndUpdate: vi.fn(),
    },
}));

vi.mock('../models/listener.model.js', () => ({
    Listener: {
        findOne:        vi.fn(),
        findOneAndUpdate: vi.fn(),
        find:           vi.fn().mockResolvedValue([]),
        updateMany:     vi.fn(),
        aggregate:      vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('../models/song.model.js', () => ({
    Song: { findById: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
}));

vi.mock('../models/transaction.model.js', () => ({
    Transaction: { aggregate: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../models/roomFavorite.model.js', () => ({
    RoomFavorite: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn(), find: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../models/inviteLog.model.js', () => ({
    InviteLog: { updateOne: vi.fn() },
}));

vi.mock('../models/songPlay.model.js', () => ({
    SongPlay: { create: vi.fn(), aggregate: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../models/listenEvent.model.js', () => ({
    ListenEvent: { insertMany: vi.fn() },
}));

vi.mock('../lib/redis.js', () => ({
    redis: { zincrby: vi.fn(), expire: vi.fn() },
}));

vi.mock('../lib/socket-manager.js', () => ({
    socketManager: {
        getRoomCapacityByTier:    vi.fn().mockReturnValue(50),
        isRoomAtCapacity:         vi.fn().mockResolvedValue(false),
        addRoomListener:          vi.fn(),
        removeRoomListener:       vi.fn(),
        getRoomById:              vi.fn().mockResolvedValue(null),
        getRoomPlaybackState:     vi.fn().mockResolvedValue(null),
        addRoomSession:           vi.fn(),
        cacheRoomPlaylist:        vi.fn(),
        removeRoomSession:        vi.fn(),
    },
}));

vi.mock('../lib/io.js', () => ({ getIo: vi.fn().mockReturnValue(null) }));

vi.mock('../controllers/notification.controller.js', () => ({
    createNotification: vi.fn(),
}));

vi.mock('../services/s3.services.js', () => ({
    getPresignedUrl:    vi.fn().mockResolvedValue('https://s3.example.com/song.mp3'),
    getPutPresignedUrl: vi.fn(),
}));

import { goLive, joinRoom, getPublicRooms, getCreatorRoomAnalytics } from '../services/room.service.js';
import { Room } from '../models/room.model.js';
import { User } from '../models/user.model.js';
import { socketManager } from '../lib/socket-manager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makePopulateChain = (result) => ({
    populate: vi.fn().mockResolvedValue(result),
});

const makeDiscoveryChain = (result = []) => ({
    populate: vi.fn().mockReturnThis(),
    sort:     vi.fn().mockReturnThis(),
    skip:     vi.fn().mockReturnThis(),
    limit:    vi.fn().mockResolvedValue(result),
});

beforeEach(() => {
    vi.clearAllMocks();
    Room.countDocuments.mockResolvedValue(0);
    Room.aggregate.mockResolvedValue([]);
    socketManager.isRoomAtCapacity.mockResolvedValue(false);
    socketManager.getRoomById.mockResolvedValue(null);
});

// ── AC-1 to AC-3: goLive guards ───────────────────────────────────────────────

describe('goLive ownership and state guards', () => {
    it('AC-1: throws if room is not found', async () => {
        User.findOne.mockResolvedValue({ _id: 'user-1' });
        Room.findById.mockReturnValue(makePopulateChain(null));
        await expect(goLive('room-1', 'clerk-1')).rejects.toThrow('Room not found');
    });

    it('AC-2: throws if caller is not the creator', async () => {
        User.findOne.mockResolvedValue({ _id: { toString: () => 'user-1' } });
        const room = {
            _id: 'room-1',
            creatorId: { toString: () => 'someone-else' },
            status: 'offline',
            playlist: [],
            toObject: vi.fn().mockReturnValue({}),
        };
        Room.findById.mockReturnValue(makePopulateChain(room));
        await expect(goLive('room-1', 'clerk-1')).rejects.toThrow('Only the creator can go live');
    });

    it('AC-3: throws if room is already live', async () => {
        User.findOne.mockResolvedValue({ _id: { toString: () => 'user-1' } });
        const room = {
            _id: 'room-1',
            creatorId: { toString: () => 'user-1' },
            status: 'live',
            playlist: [],
        };
        Room.findById.mockReturnValue(makePopulateChain(room));
        await expect(goLive('room-1', 'clerk-1')).rejects.toThrow('Room is already live');
    });
});

// ── AC-4 to AC-5: joinRoom guards ─────────────────────────────────────────────

describe('joinRoom live-state and capacity guards', () => {
    it('AC-4: throws if room is not live', async () => {
        User.findOne.mockResolvedValue({ _id: 'user-1' });
        Room.findById.mockReturnValue(makePopulateChain({ status: 'offline', playlist: [] }));
        await expect(joinRoom('room-1', 'clerk-1')).rejects.toThrow('Room is not live');
    });

    it('AC-5: throws if room is at capacity', async () => {
        User.findOne.mockResolvedValue({ _id: 'user-1' });
        Room.findById.mockReturnValue(makePopulateChain({ status: 'live', playlist: [] }));
        socketManager.isRoomAtCapacity.mockResolvedValue(true);
        await expect(joinRoom('room-1', 'clerk-1')).rejects.toThrow('Room is full');
    });
});

// ── AC-6 to AC-10: getPublicRooms query construction ─────────────────────────

describe('getPublicRooms query construction', () => {
    it('AC-6: search term applied as $regex on title', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({ search: 'jazz', limit: 10, offset: 0 });
        const query = Room.find.mock.calls[0][0];
        expect(query.title).toEqual({ $regex: 'jazz', $options: 'i' });
    });

    it('AC-7: single tag uses exact-match (not $in)', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({ tag: 'lofi', limit: 10, offset: 0 });
        const query = Room.find.mock.calls[0][0];
        expect(query.tags).toBe('lofi');
    });

    it('AC-8: multiple comma-sep tags use $in', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({ tags: 'lofi,jazz,pop', limit: 10, offset: 0 });
        const query = Room.find.mock.calls[0][0];
        expect(query.tags).toEqual({ $in: ['lofi', 'jazz', 'pop'] });
    });

    it('AC-9: limit is hard-capped at 100', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({ limit: 999 });
        const chain = Room.find.mock.results[0].value;
        expect(chain.limit).toHaveBeenCalledWith(100);
    });

    it('AC-10: status:"live" filter applied to DB query', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({ status: 'live' });
        const query = Room.find.mock.calls[0][0];
        expect(query.status).toBe('live');
    });

    it('AC-10b: no status param does not include status in query', async () => {
        Room.find.mockReturnValue(makeDiscoveryChain());
        await getPublicRooms({});
        const query = Room.find.mock.calls[0][0];
        expect(query.status).toBeUndefined();
    });
});

// ── AC-11 to AC-14: getCreatorRoomAnalytics input validation ──────────────────

describe('getCreatorRoomAnalytics input validation', () => {
    it('AC-11: from >= to throws 400 before any DB call', async () => {
        const err = await getCreatorRoomAnalytics('clerk-1', {
            from: '2026-02-01',
            to:   '2026-01-01',
        }).catch(e => e);
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/from.*before.*to/i);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('AC-12: range > 366 days throws 400', async () => {
        const err = await getCreatorRoomAnalytics('clerk-1', {
            from: '2024-01-01',
            to:   '2026-01-15',
        }).catch(e => e);
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/366/);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('AC-13: user not found throws 404', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
        const err = await getCreatorRoomAnalytics('clerk-ghost', {
            from: '2026-01-01',
            to:   '2026-02-01',
        }).catch(e => e);
        expect(err.statusCode).toBe(404);
        expect(err.message).toMatch(/user not found/i);
    });

    it('AC-14: user found but no room returns empty analytics shape', async () => {
        User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'user-1' }) });
        Room.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
        const result = await getCreatorRoomAnalytics('clerk-1', {
            from: '2026-01-01',
            to:   '2026-02-01',
        });
        expect(result.room).toBeNull();
        expect(result.summary.sessions).toBe(0);
        expect(result.sessionTrend).toEqual([]);
        expect(result.topSongs).toEqual([]);
    });
});
