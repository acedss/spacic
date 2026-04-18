/**
 * Tier Features — Acceptance Tests
 *
 * Validates that subscription tiers correctly gate room features.
 *
 * Acceptance Criteria (Product Owner):
 * AC-1: FREE tier — capacity=10, sessionLimit=60min
 * AC-2: PREMIUM tier — capacity=50, sessionLimit=180min
 * AC-3: CREATOR tier — capacity=unlimited, sessionLimit=unlimited
 * AC-4: Room capacity is enforced (no joins beyond limit)
 * AC-5: Session timer math — remaining time = max - elapsed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis (minimal for capacity check) ─────────────────────────────────

const store = {};
const sets  = {};

const mockRedis = {
    hset:    vi.fn(async (key, data) => { store[key] = { ...(store[key] || {}), ...data }; }),
    hgetall: vi.fn(async (key) => store[key] || {}),
    hmget:   vi.fn(async (key, ...fields) => fields.map(f => store[key]?.[f] ?? null)),
    del:     vi.fn(async (...keys) => { keys.forEach(k => { delete store[k]; delete sets[k]; }); }),
    expire:  vi.fn(async () => {}),
    sadd:    vi.fn(async (key, member) => { if (!sets[key]) sets[key] = new Set(); sets[key].add(member); return 1; }),
    srem:    vi.fn(async (key, member) => { sets[key]?.delete(member); return 1; }),
    scard:   vi.fn(async (key) => sets[key]?.size ?? 0),
    set:     vi.fn(async () => {}),
    get:     vi.fn(async () => null),
};

vi.mock('../lib/redis.js', () => ({ redis: mockRedis }));

const { socketManager } = await import('../lib/socket-manager.js');

beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    Object.keys(sets).forEach(k => delete sets[k]);
    vi.clearAllMocks();
});

// ── AC-1: FREE tier limits ──────────────────────────────────────────────────

describe('AC-1: FREE tier — capacity=10, session=60min', () => {
    it('capacity is 10', () => {
        expect(socketManager.getRoomCapacityByTier('FREE')).toBe(10);
    });

    it('max session is 60 minutes', () => {
        expect(socketManager.getMaxSessionMinutesByTier('FREE')).toBe(60);
    });
});

// ── AC-2: PREMIUM tier limits ───────────────────────────────────────────────

describe('AC-2: PREMIUM tier — capacity=50, session=180min', () => {
    it('capacity is 50', () => {
        expect(socketManager.getRoomCapacityByTier('PREMIUM')).toBe(50);
    });

    it('max session is 180 minutes', () => {
        expect(socketManager.getMaxSessionMinutesByTier('PREMIUM')).toBe(180);
    });
});

// ── AC-3: CREATOR tier limits ───────────────────────────────────────────────

describe('AC-3: CREATOR tier — unlimited', () => {
    it('capacity is Infinity', () => {
        expect(socketManager.getRoomCapacityByTier('CREATOR')).toBe(Infinity);
    });

    it('max session is Infinity', () => {
        expect(socketManager.getMaxSessionMinutesByTier('CREATOR')).toBe(Infinity);
    });
});

// ── AC-4: Room capacity enforcement ─────────────────────────────────────────

describe('AC-4: Room capacity enforced via isRoomAtCapacity', () => {
    const ROOM_ID = 'room-cap-test';

    it('GIVEN room with capacity 2 AND 1 listener THEN not at capacity', async () => {
        await socketManager.addRoomSession(ROOM_ID, {
            creatorId: 'creator-1', title: 'Test', capacity: 2,
            currentSongId: null, currentSongS3Key: null,
            startTimeUnix: Date.now(), pausedAtMs: 0, isPlaying: true,
        });
        await socketManager.addRoomListener(ROOM_ID, 'user-1');

        expect(await socketManager.isRoomAtCapacity(ROOM_ID)).toBe(false);
    });

    it('GIVEN room with capacity 2 AND 2 listeners THEN at capacity', async () => {
        await socketManager.addRoomSession(ROOM_ID, {
            creatorId: 'creator-1', title: 'Test', capacity: 2,
            currentSongId: null, currentSongS3Key: null,
            startTimeUnix: Date.now(), pausedAtMs: 0, isPlaying: true,
        });
        await socketManager.addRoomListener(ROOM_ID, 'user-1');
        await socketManager.addRoomListener(ROOM_ID, 'user-2');

        expect(await socketManager.isRoomAtCapacity(ROOM_ID)).toBe(true);
    });

    it('GIVEN at capacity WHEN listener leaves THEN not at capacity', async () => {
        await socketManager.addRoomSession(ROOM_ID, {
            creatorId: 'creator-1', title: 'Test', capacity: 2,
            currentSongId: null, currentSongS3Key: null,
            startTimeUnix: Date.now(), pausedAtMs: 0, isPlaying: true,
        });
        await socketManager.addRoomListener(ROOM_ID, 'user-1');
        await socketManager.addRoomListener(ROOM_ID, 'user-2');
        await socketManager.removeRoomListener(ROOM_ID, 'user-2');

        expect(await socketManager.isRoomAtCapacity(ROOM_ID)).toBe(false);
    });
});

// ── AC-5: Session timer math ────────────────────────────────────────────────

describe('AC-5: Session timer — remaining = max - elapsed', () => {
    it('GIVEN FREE room live for 30min THEN 30min remaining', () => {
        const maxMinutes   = socketManager.getMaxSessionMinutesByTier('FREE');
        const elapsedMs    = 30 * 60_000;
        const remainingMs  = maxMinutes * 60_000 - elapsedMs;
        expect(remainingMs / 60_000).toBe(30);
    });

    it('GIVEN FREE room live for 60min THEN 0 remaining', () => {
        const maxMinutes   = socketManager.getMaxSessionMinutesByTier('FREE');
        const elapsedMs    = 60 * 60_000;
        const remainingMs  = maxMinutes * 60_000 - elapsedMs;
        expect(remainingMs).toBe(0);
    });

    it('GIVEN CREATOR tier THEN Infinity - elapsed = Infinity', () => {
        const maxMinutes = socketManager.getMaxSessionMinutesByTier('CREATOR');
        expect(Number.isFinite(maxMinutes)).toBe(false);
    });
});
