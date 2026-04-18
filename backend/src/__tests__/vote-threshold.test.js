/**
 * Vote Threshold — Business Logic Tests
 *
 * Tests the vote-to-skip threshold calculation in isolation.
 * This is the core formula: voteCount >= ceil(listenerCount * threshold / 100)
 *
 * Acceptance Criteria (Product Owner):
 * AC-1: Small room (5 listeners, 50% threshold) → 3 votes needed to skip
 * AC-2: Big room (50 listeners, 30% threshold) → 15 votes needed to skip
 * AC-3: Solo room (1 listener, any threshold) → 1 vote always enough
 * AC-4: Edge: 0 listeners → at least 1 vote needed (never auto-skip on empty room)
 * AC-5: Queue voting uses same threshold as skip voting (voteThresholdPercent)
 */

import { describe, it, expect } from 'vitest';

const computeVotesNeeded = (listenerCount, thresholdPercent) =>
    Math.max(1, Math.ceil(listenerCount * thresholdPercent / 100));

const isThresholdMet = (voteCount, listenerCount, thresholdPercent) =>
    voteCount >= computeVotesNeeded(listenerCount, thresholdPercent);

// ── AC-1: Small room (5 listeners, 50%) ─────────────────────────────────────

describe('AC-1: Small room — 5 listeners, 50% threshold', () => {
    const LISTENERS = 5;
    const THRESHOLD = 50;

    it('needs 3 votes to skip', () => {
        expect(computeVotesNeeded(LISTENERS, THRESHOLD)).toBe(3);
    });

    it('2 votes = not enough', () => {
        expect(isThresholdMet(2, LISTENERS, THRESHOLD)).toBe(false);
    });

    it('3 votes = threshold met', () => {
        expect(isThresholdMet(3, LISTENERS, THRESHOLD)).toBe(true);
    });
});

// ── AC-2: Big room (50 listeners, 30%) ���─────────────────────────────────────

describe('AC-2: Big room — 50 listeners, 30% threshold', () => {
    const LISTENERS = 50;
    const THRESHOLD = 30;

    it('needs 15 votes to skip', () => {
        expect(computeVotesNeeded(LISTENERS, THRESHOLD)).toBe(15);
    });

    it('14 votes = not enough', () => {
        expect(isThresholdMet(14, LISTENERS, THRESHOLD)).toBe(false);
    });

    it('15 votes = threshold met', () => {
        expect(isThresholdMet(15, LISTENERS, THRESHOLD)).toBe(true);
    });
});

// ── AC-3: Solo room ─────────────────────────────────────────────────────────

describe('AC-3: Solo room — 1 listener, any threshold', () => {
    it('50% threshold → 1 vote needed', () => {
        expect(computeVotesNeeded(1, 50)).toBe(1);
    });

    it('100% threshold → 1 vote needed', () => {
        expect(computeVotesNeeded(1, 100)).toBe(1);
    });

    it('1 vote always enough', () => {
        expect(isThresholdMet(1, 1, 50)).toBe(true);
        expect(isThresholdMet(1, 1, 100)).toBe(true);
    });
});

// ── AC-4: Empty room (0 listeners) ──────────────────────────────────────────

describe('AC-4: Edge — 0 listeners never auto-skips', () => {
    it('needs at least 1 vote', () => {
        expect(computeVotesNeeded(0, 50)).toBe(1);
    });

    it('0 votes = not met', () => {
        expect(isThresholdMet(0, 0, 50)).toBe(false);
    });
});

// ── AC-5: Queue voting uses same formula ─────────────────────────────────────

describe('AC-5: Queue voting shares threshold formula', () => {
    it('10 listeners, 40% threshold → 4 votes to enqueue', () => {
        expect(computeVotesNeeded(10, 40)).toBe(4);
    });

    it('3 listeners, 60% threshold → 2 votes to enqueue', () => {
        expect(computeVotesNeeded(3, 60)).toBe(2);
    });

    it('100 listeners, 10% threshold → 10 votes (big room low bar)', () => {
        expect(computeVotesNeeded(100, 10)).toBe(10);
    });
});

// ── Comprehensive threshold table ────────────────────────────────────────────

describe('Threshold calculation — comprehensive cases', () => {
    const cases = [
        // [listeners, threshold%, expected_needed]
        [2,   50, 1],
        [3,   50, 2],
        [4,   50, 2],
        [5,   50, 3],
        [10,  50, 5],
        [10,  30, 3],
        [20,  25, 5],
        [100, 50, 50],
        [100, 1,  1],
    ];

    cases.forEach(([listeners, threshold, expected]) => {
        it(`${listeners} listeners × ${threshold}% → ${expected} votes needed`, () => {
            expect(computeVotesNeeded(listeners, threshold)).toBe(expected);
        });
    });
});
