/**
 * Minigame Service — Unit Tests
 *
 * Tests recordAnswer (answer checking) and settleGamePrize (reward distribution)
 * in isolation with mocked Mongoose models.
 *
 * Acceptance Criteria (Product Owner):
 * AC-1: song_guesser — first correct answer sets winner; wrong answer ignored
 * AC-2: lyric_fill   — same first-correct logic as song_guesser
 * AC-3: trivia       — compares numeric correctOption, not string
 * AC-4: skip_battle  — no winner set (vote-based, handled by socket)
 * AC-5: Double-submit — second answer from same user does not overwrite winner
 * AC-6: Game not active — recordAnswer returns null without touching DB
 * AC-7: settleGamePrize winner — awards winPoints to winner, creates transaction
 * AC-8: settleGamePrize no winner — refunds coins to creator
 * AC-9: settleGamePrize zero reward — exits early, no DB write
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ────────────────────────────────────────────────────────

const mockGameData = {};
const savedUsers   = {};
const savedTxns    = [];

const makeGame = (overrides = {}) => ({
    _id:              'game-1',
    status:           'active',
    type:             'song_guesser',
    participantCount: 0,
    coinReward:       100,
    creatorId:        'creator-1',
    config:           { answer: 'Blinding Lights' },
    winner:           { userId: null, username: null, answer: null },
    save:             vi.fn(async function() { Object.assign(mockGameData, this); }),
    ...overrides,
});

// ── Mongoose model mocks ─────────────────────────────────────────────────────

vi.mock('../models/minigame.model.js', () => ({
    Minigame: {
        findById:          vi.fn(),
        findOneAndUpdate:  vi.fn(),
        findByIdAndUpdate: vi.fn(),
    },
}));

vi.mock('../models/user.model.js', () => ({
    User: {
        updateOne: vi.fn(async (filter, update) => {
            const id = filter._id;
            if (!savedUsers[id]) savedUsers[id] = {};
            const inc = update.$inc || {};
            Object.entries(inc).forEach(([k, v]) => {
                savedUsers[id][k] = (savedUsers[id][k] || 0) + v;
            });
        }),
    },
}));

vi.mock('../models/transaction.model.js', () => ({
    Transaction: {
        create: vi.fn(async (data) => { savedTxns.push(data); return data; }),
    },
}));

vi.mock('../models/room.model.js', () => ({ Room: {} }));

import { Minigame } from '../models/minigame.model.js';
import { recordAnswer, settleGamePrize, completeGame } from '../services/minigame.service.js';

beforeEach(() => {
    vi.clearAllMocks();
    savedTxns.length = 0;
    Object.keys(savedUsers).forEach(k => delete savedUsers[k]);
    Object.keys(mockGameData).forEach(k => delete mockGameData[k]);
});

// ── AC-1: song_guesser — correct answer wins ─────────────────────────────────

describe('AC-1: song_guesser correct answer sets winner', () => {
    it('GIVEN active game WHEN correct answer submitted THEN isWinner=true and winner set', async () => {
        const game = makeGame({ type: 'song_guesser', config: { answer: 'Blinding Lights' } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'Blinding Lights');

        expect(result.isWinner).toBe(true);
        expect(game.winner.userId).toBe('user-1');
        expect(game.winner.username).toBe('Alice');
        expect(game.save).toHaveBeenCalledOnce();
    });

    it('GIVEN active game WHEN wrong answer submitted THEN isWinner=false, no winner', async () => {
        const game = makeGame({ type: 'song_guesser', config: { answer: 'Blinding Lights' } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'Wrong Song');

        expect(result.isWinner).toBe(false);
        expect(game.winner.userId).toBeNull();
    });

    it('GIVEN answer THEN case-insensitive match works', async () => {
        const game = makeGame({ type: 'song_guesser', config: { answer: 'Blinding Lights' } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'blinding lights');
        expect(result.isWinner).toBe(true);
    });

    it('GIVEN answer THEN participantCount increments regardless of correctness', async () => {
        const game = makeGame({ type: 'song_guesser', config: { answer: 'Blinding Lights' } });
        Minigame.findById.mockResolvedValue(game);

        await recordAnswer('game-1', 'user-1', 'Alice', 'wrong');
        expect(game.participantCount).toBe(1);
    });
});

// ── AC-2: lyric_fill — same first-correct logic ──────────────────────────────

describe('AC-2: lyric_fill correct answer', () => {
    it('GIVEN lyric_fill game WHEN correct word submitted THEN winner set', async () => {
        const game = makeGame({ type: 'lyric_fill', config: { lyric: 'She said ___ and left', answer: 'goodbye' } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-2', 'Bob', 'goodbye');
        expect(result.isWinner).toBe(true);
        expect(game.winner.userId).toBe('user-2');
    });
});

// ── AC-3: trivia — compares numeric correctOption ────────────────────────────

describe('AC-3: trivia compares numeric correctOption', () => {
    it('GIVEN trivia game with correctOption=2 WHEN user answers "2" THEN winner', async () => {
        const game = makeGame({ type: 'trivia', config: { question: 'Pick one', correctOption: 2 } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', '2');
        expect(result.isWinner).toBe(true);
    });

    it('GIVEN trivia WHEN wrong option submitted THEN no winner', async () => {
        const game = makeGame({ type: 'trivia', config: { question: 'Pick one', correctOption: 2 } });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', '1');
        expect(result.isWinner).toBe(false);
    });
});

// ── AC-4: skip_battle — no winner set by recordAnswer ───────────────────────

describe('AC-4: skip_battle — winner not set by recordAnswer', () => {
    it('GIVEN skip_battle WHEN answer submitted THEN participantCount++ but no winner', async () => {
        const game = makeGame({ type: 'skip_battle', config: {} });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'anything');
        expect(result.isWinner).toBe(false);
        expect(game.winner.userId).toBeNull();
        expect(game.participantCount).toBe(1);
    });
});

// ── AC-5: double-submit does not overwrite winner ────────────────────────────

describe('AC-5: first winner locked in — second correct answer ignored', () => {
    it('GIVEN user-1 already won WHEN user-2 submits correct answer THEN winner unchanged', async () => {
        const game = makeGame({
            type: 'song_guesser',
            config: { answer: 'Blinding Lights' },
            // winner already set from a previous call
            winner: { userId: 'user-1', username: 'Alice', answer: 'Blinding Lights' },
        });
        Minigame.findById.mockResolvedValue(game);

        const result = await recordAnswer('game-1', 'user-2', 'Bob', 'Blinding Lights');
        expect(result.isWinner).toBe(false);
        expect(game.winner.userId).toBe('user-1'); // unchanged
    });
});

// ── AC-6: game not active — returns null ─────────────────────────────────────

describe('AC-6: recordAnswer on completed/inactive game returns null', () => {
    it('GIVEN completed game THEN returns null', async () => {
        Minigame.findById.mockResolvedValue(makeGame({ status: 'completed' }));
        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'anything');
        expect(result).toBeNull();
    });

    it('GIVEN game not found THEN returns null', async () => {
        Minigame.findById.mockResolvedValue(null);
        const result = await recordAnswer('game-1', 'user-1', 'Alice', 'anything');
        expect(result).toBeNull();
    });
});

// ── AC-7: settleGamePrize — winner gets winPoints ────────────────────────────

describe('AC-7: settleGamePrize awards winPoints to winner', () => {
    it('GIVEN game with winner THEN winner.winPoints incremented + transaction created', async () => {
        const completedGame = {
            coinReward: 100,
            creatorId:  'creator-1',
            winner:     { userId: 'user-1', username: 'Alice', answer: 'Blinding Lights' },
        };
        await settleGamePrize(completedGame);

        expect(savedUsers['user-1']?.winPoints).toBe(100);
        expect(savedTxns).toHaveLength(1);
        expect(savedTxns[0]).toMatchObject({ type: 'minigame_win', currency: 'winPoints', amount: 100 });
    });
});

// ── AC-8: settleGamePrize — no winner refunds creator ────────────────────────

describe('AC-8: settleGamePrize refunds creator when no winner', () => {
    it('GIVEN no winner THEN creator.balance refunded + refund transaction', async () => {
        const completedGame = {
            coinReward: 200,
            creatorId:  'creator-1',
            winner:     { userId: null },
        };
        await settleGamePrize(completedGame);

        expect(savedUsers['creator-1']?.balance).toBe(200);
        expect(savedTxns).toHaveLength(1);
        expect(savedTxns[0]).toMatchObject({ type: 'minigame_refund', currency: 'coins', amount: 200 });
    });
});

// ── AC-9: zero reward exits early ────────────────────────────────────────────

describe('AC-9: settleGamePrize with coinReward=0 does nothing', () => {
    it('GIVEN coinReward=0 THEN no User.updateOne or Transaction.create called', async () => {
        const { User } = await import('../models/user.model.js');
        const { Transaction } = await import('../models/transaction.model.js');

        await settleGamePrize({ coinReward: 0, creatorId: 'creator-1', winner: { userId: null } });

        expect(User.updateOne).not.toHaveBeenCalled();
        expect(Transaction.create).not.toHaveBeenCalled();
    });
});
