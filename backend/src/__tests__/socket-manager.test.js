/**
 * SocketManager — Unit Tests
 *
 * Tests the Redis-backed state manager in isolation.
 * All Redis calls are mocked; we test the business logic layer.
 *
 * Acceptance Criteria (Product Owner):
 * AC-1: Room capacity is tier-gated (FREE=10, PREMIUM=50, CREATOR=∞)
 * AC-2: Session time limits are tier-gated (FREE=60m, PREMIUM=180m, CREATOR=∞)
 * AC-3: Skip votes are tracked per-room, per-user (no double voting)
 * AC-4: Song reactions support like/dislike with toggle (switch without double-vote)
 * AC-5: Emoji burst is rate-limited to 3 per 5 seconds per user
 * AC-6: Queue nominations are sorted by vote count descending
 * AC-7: Clearing per-song state removes votes and reactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis ──────────────────────────────────────────────────────────────

const store = {};
const sets  = {};
const zsets = {};

const mockRedis = {
    hset:    vi.fn(async (key, data) => { store[key] = { ...(store[key] || {}), ...data }; }),
    hgetall: vi.fn(async (key) => store[key] || {}),
    hmget:   vi.fn(async (key, ...fields) => fields.map(f => store[key]?.[f] ?? null)),
    hget:    vi.fn(async (key, field) => store[key]?.[field] ?? null),
    del:     vi.fn(async (...keys) => { keys.forEach(k => { delete store[k]; delete sets[k]; delete zsets[k]; }); }),
    expire:  vi.fn(async () => {}),
    exists:  vi.fn(async (key) => store[key] ? 1 : 0),

    sadd:      vi.fn(async (key, member) => { if (!sets[key]) sets[key] = new Set(); sets[key].add(member); return 1; }),
    srem:      vi.fn(async (key, member) => { sets[key]?.delete(member); return 1; }),
    scard:     vi.fn(async (key) => sets[key]?.size ?? 0),
    sismember: vi.fn(async (key, member) => sets[key]?.has(member) ? 1 : 0),
    smembers:  vi.fn(async (key) => [...(sets[key] || [])]),

    incr:   vi.fn(async (key) => { store[key] = (store[key] || 0) + 1; return store[key]; }),
    set:    vi.fn(async (key, val) => { store[key] = val; }),
    get:    vi.fn(async (key) => store[key] ?? null),

    hincrby: vi.fn(async (key, field, inc) => {
        if (!store[key]) store[key] = {};
        store[key][field] = (parseInt(store[key][field] || '0', 10) + inc).toString();
        return parseInt(store[key][field], 10);
    }),

    zadd:      vi.fn(async (key, score, member) => { if (!zsets[key]) zsets[key] = new Map(); zsets[key].set(member, score); }),
    zincrby:   vi.fn(async (key, inc, member) => { if (!zsets[key]) zsets[key] = new Map(); const n = (zsets[key].get(member) || 0) + inc; zsets[key].set(member, n); return n; }),
    zrem:      vi.fn(async (key, member) => { zsets[key]?.delete(member); }),
    zrange:    vi.fn(async (key) => [...(zsets[key]?.keys() || [])]),
    zrevrange: vi.fn(async (key, start, end, withScores) => {
        const entries = [...(zsets[key]?.entries() || [])].sort((a, b) => b[1] - a[1]);
        const result = [];
        for (const [m, s] of entries) { result.push(m); if (withScores === 'WITHSCORES') result.push(String(s)); }
        return result;
    }),

    rpush:  vi.fn(async () => {}),
    lrange: vi.fn(async () => []),
    lset:   vi.fn(async () => {}),
    lrem:   vi.fn(async () => {}),
};

vi.mock('../lib/redis.js', () => ({ redis: mockRedis }));

const { socketManager } = await import('../lib/socket-manager.js');

beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    Object.keys(sets).forEach(k => delete sets[k]);
    Object.keys(zsets).forEach(k => delete zsets[k]);
    vi.clearAllMocks();
});

// ── AC-1: Room capacity by tier ──────────────────────────────────────────────

describe('AC-1: Room capacity is tier-gated', () => {
    it('FREE tier gets capacity of 10', () => {
        expect(socketManager.getRoomCapacityByTier('FREE')).toBe(10);
    });

    it('PREMIUM tier gets capacity of 50', () => {
        expect(socketManager.getRoomCapacityByTier('PREMIUM')).toBe(50);
    });

    it('CREATOR tier gets unlimited capacity', () => {
        expect(socketManager.getRoomCapacityByTier('CREATOR')).toBe(Infinity);
    });

    it('unknown tier defaults to 10', () => {
        expect(socketManager.getRoomCapacityByTier('UNKNOWN')).toBe(10);
    });
});

// ── AC-2: Session time limits by tier ────────────────────────────────────────

describe('AC-2: Session time limits are tier-gated', () => {
    it('FREE tier gets 60 minutes', () => {
        expect(socketManager.getMaxSessionMinutesByTier('FREE')).toBe(60);
    });

    it('PREMIUM tier gets 180 minutes', () => {
        expect(socketManager.getMaxSessionMinutesByTier('PREMIUM')).toBe(180);
    });

    it('CREATOR tier gets unlimited session', () => {
        expect(socketManager.getMaxSessionMinutesByTier('CREATOR')).toBe(Infinity);
    });

    it('unknown tier defaults to 60 minutes', () => {
        expect(socketManager.getMaxSessionMinutesByTier('BOGUS')).toBe(60);
    });
});

// ── AC-3: Skip voting ───────────────────────────────────────────────────────

describe('AC-3: Skip votes — no double voting, count tracking', () => {
    const ROOM = 'room-abc';

    it('GIVEN no votes WHEN first user votes THEN count = 1', async () => {
        await socketManager.addSkipVote(ROOM, 'user-1');
        const count = await socketManager.getSkipVoteCount(ROOM);
        expect(count).toBe(1);
    });

    it('GIVEN user already voted WHEN same user votes THEN count unchanged', async () => {
        await socketManager.addSkipVote(ROOM, 'user-1');
        await socketManager.addSkipVote(ROOM, 'user-1'); // duplicate
        const count = await socketManager.getSkipVoteCount(ROOM);
        expect(count).toBe(1); // Redis SET deduplicates
    });

    it('GIVEN 2 users voted WHEN hasVotedToSkip THEN returns correct status', async () => {
        await socketManager.addSkipVote(ROOM, 'user-1');
        await socketManager.addSkipVote(ROOM, 'user-2');
        expect(await socketManager.hasVotedToSkip(ROOM, 'user-1')).toBeTruthy();
        expect(await socketManager.hasVotedToSkip(ROOM, 'user-3')).toBeFalsy();
    });

    it('GIVEN votes exist WHEN clearSkipVotes THEN count = 0', async () => {
        await socketManager.addSkipVote(ROOM, 'user-1');
        await socketManager.addSkipVote(ROOM, 'user-2');
        await socketManager.clearSkipVotes(ROOM);
        const count = await socketManager.getSkipVoteCount(ROOM);
        expect(count).toBe(0);
    });
});

// ── AC-4: Song reactions (like/dislike toggle) ──────────────────────────────

describe('AC-4: Song reactions — like/dislike with toggle', () => {
    const ROOM = 'room-reactions';

    it('GIVEN no reactions WHEN user likes THEN likes=1, dislikes=0', async () => {
        const result = await socketManager.addSongReaction(ROOM, 'user-1', 'like');
        expect(result).not.toBeNull();
        expect(result.likes).toBe(1);
        expect(result.dislikes).toBe(0);
    });

    it('GIVEN user liked WHEN same user likes again THEN returns null (blocked)', async () => {
        await socketManager.addSongReaction(ROOM, 'user-1', 'like');
        const result = await socketManager.addSongReaction(ROOM, 'user-1', 'like');
        expect(result).toBeNull();
    });

    it('GIVEN user liked WHEN user dislikes THEN toggles: likes=0, dislikes=1', async () => {
        await socketManager.addSongReaction(ROOM, 'user-1', 'like');
        const result = await socketManager.addSongReaction(ROOM, 'user-1', 'dislike');
        expect(result).not.toBeNull();
        expect(result.likes).toBe(0);
        expect(result.dislikes).toBe(1);
        expect(result.toggled).toBe(true);
    });

    it('GIVEN reactions exist WHEN clearSongReactions THEN counts reset', async () => {
        await socketManager.addSongReaction(ROOM, 'user-1', 'like');
        await socketManager.addSongReaction(ROOM, 'user-2', 'dislike');
        await socketManager.clearSongReactions(ROOM);
        const counts = await socketManager.getSongReactionCounts(ROOM);
        expect(counts.likes).toBe(0);
        expect(counts.dislikes).toBe(0);
    });
});

// ── AC-5: Emoji rate limiting ───────────────────────────────────────────────

describe('AC-5: Emoji burst rate-limited to 3 per 5 seconds', () => {
    const ROOM = 'room-emoji';

    it('GIVEN fresh state WHEN user sends 3 emojis THEN all allowed', async () => {
        expect(await socketManager.canSendEmoji(ROOM, 'user-1')).toBe(true);
        expect(await socketManager.canSendEmoji(ROOM, 'user-1')).toBe(true);
        expect(await socketManager.canSendEmoji(ROOM, 'user-1')).toBe(true);
    });

    it('GIVEN 3 emojis sent WHEN 4th emoji THEN blocked', async () => {
        await socketManager.canSendEmoji(ROOM, 'user-1');
        await socketManager.canSendEmoji(ROOM, 'user-1');
        await socketManager.canSendEmoji(ROOM, 'user-1');
        expect(await socketManager.canSendEmoji(ROOM, 'user-1')).toBe(false);
    });

    it('GIVEN user-1 rate limited WHEN user-2 sends THEN allowed', async () => {
        for (let i = 0; i < 4; i++) await socketManager.canSendEmoji(ROOM, 'user-1');
        expect(await socketManager.canSendEmoji(ROOM, 'user-2')).toBe(true);
    });
});

// ── AC-6: Queue nominations sorted by votes ────────────────────────────────

describe('AC-6: Queue nominations sorted by vote count', () => {
    const ROOM = 'room-queue';

    it('GIVEN no nominations WHEN getQueueNominations THEN empty array', async () => {
        const noms = await socketManager.getQueueNominations(ROOM);
        expect(noms).toEqual([]);
    });

    it('GIVEN a nomination WHEN another user votes THEN score increases', async () => {
        await socketManager.nominateSong(ROOM, 'song-1', 'user-1', {
            title: 'Test Song', artist: 'Artist', nominatorName: 'Alice',
        });
        const score = await socketManager.voteForSong(ROOM, 'song-1', 'user-2');
        expect(score).toBe(2);
    });

    it('GIVEN user already voted WHEN votes again THEN returns null', async () => {
        await socketManager.nominateSong(ROOM, 'song-1', 'user-1', {
            title: 'Test', artist: 'A', nominatorName: 'Alice',
        });
        const score = await socketManager.voteForSong(ROOM, 'song-1', 'user-1');
        expect(score).toBeNull();
    });

    it('GIVEN nomination removed WHEN getQueueNominations THEN not included', async () => {
        await socketManager.nominateSong(ROOM, 'song-1', 'user-1', {
            title: 'Test', artist: 'A', nominatorName: 'Alice',
        });
        await socketManager.removeNomination(ROOM, 'song-1');
        const noms = await socketManager.getQueueNominations(ROOM);
        expect(noms.find(n => n.songId === 'song-1')).toBeUndefined();
    });
});

// ── AC-7: Per-song state cleanup ────────────────────────────────────────────

describe('AC-7: Clearing per-song state resets votes and reactions', () => {
    const ROOM = 'room-cleanup';

    it('GIVEN votes + reactions WHEN clearSkipVotes + clearSongReactions THEN all zeroed', async () => {
        await socketManager.addSkipVote(ROOM, 'user-1');
        await socketManager.addSkipVote(ROOM, 'user-2');
        await socketManager.addSongReaction(ROOM, 'user-1', 'like');

        await socketManager.clearSkipVotes(ROOM);
        await socketManager.clearSongReactions(ROOM);

        expect(await socketManager.getSkipVoteCount(ROOM)).toBe(0);
        const counts = await socketManager.getSongReactionCounts(ROOM);
        expect(counts.likes).toBe(0);
        expect(counts.dislikes).toBe(0);
    });
});
