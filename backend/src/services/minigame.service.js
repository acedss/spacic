import { Minigame } from "../models/minigame.model.js";
import { Room }     from "../models/room.model.js";
import { User }     from "../models/user.model.js";

const resolveUser = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select('_id');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
};

const assertCreatorOwnsRoom = async (userId, roomId) => {
    const room = await Room.findById(roomId).select('creatorId');
    if (!room) throw Object.assign(new Error('Room not found'), { statusCode: 404 });
    if (room.creatorId.toString() !== userId.toString())
        throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
    return room;
};

export const getMinigamesForRoom = async (clerkId, roomId) => {
    const user = await resolveUser(clerkId);
    await assertCreatorOwnsRoom(user._id, roomId);
    return Minigame.find({ roomId }).sort({ createdAt: -1 });
};

export const createMinigame = async (clerkId, roomId, data) => {
    const user = await resolveUser(clerkId);
    await assertCreatorOwnsRoom(user._id, roomId);

    const { type, title, trigger, durationSeconds, coinReward, config } = data;
    if (!type || !title?.trim()) throw Object.assign(new Error('type and title are required'), { statusCode: 400 });

    const resolvedTrigger = trigger ?? { type: 'manual', songIndex: null };
    const status = resolvedTrigger.type !== 'manual' ? 'scheduled' : 'draft';

    return Minigame.create({
        roomId,
        creatorId: user._id,
        type,
        title: title.trim(),
        trigger: resolvedTrigger,
        durationSeconds: durationSeconds ?? 30,
        coinReward: coinReward ?? 0,
        config: config ?? {},
        status,
    });
};

export const updateMinigame = async (clerkId, minigameId, data) => {
    const user = await resolveUser(clerkId);
    const game = await Minigame.findById(minigameId);
    if (!game) throw Object.assign(new Error('Minigame not found'), { statusCode: 404 });
    await assertCreatorOwnsRoom(user._id, game.roomId);
    if (['active', 'completed'].includes(game.status))
        throw Object.assign(new Error('Cannot edit an active or completed game'), { statusCode: 409 });

    const { type, title, trigger, durationSeconds, coinReward, config } = data;
    if (type            !== undefined) game.type            = type;
    if (title           !== undefined) game.title           = title.trim();
    if (trigger         !== undefined) game.trigger         = trigger;
    if (durationSeconds !== undefined) game.durationSeconds = durationSeconds;
    if (coinReward      !== undefined) game.coinReward      = coinReward;
    if (config          !== undefined) game.config          = config;

    if (game.trigger?.type !== 'manual') game.status = 'scheduled';
    else if (game.status === 'scheduled') game.status = 'draft';

    await game.save();
    return game;
};

export const deleteMinigame = async (clerkId, minigameId) => {
    const user = await resolveUser(clerkId);
    const game = await Minigame.findById(minigameId);
    if (!game) throw Object.assign(new Error('Minigame not found'), { statusCode: 404 });
    await assertCreatorOwnsRoom(user._id, game.roomId);
    if (game.status === 'active') throw Object.assign(new Error('Cannot delete an active game'), { statusCode: 409 });
    await game.deleteOne();
};

// ── Socket helpers ────────────────────────────────────────────────────────────
// Called from socket.js at song transition to check for scheduled games.

export const findAndActivateScheduledGame = async (roomId, triggerType, songIndex) => {
    return Minigame.findOneAndUpdate(
        { roomId, status: 'scheduled', 'trigger.type': triggerType, 'trigger.songIndex': songIndex },
        { $set: { status: 'active', startedAt: new Date() } },
        { new: true }
    );
};

// Records one listener answer. First correct answer wins for guessing-style games.
// Returns { isWinner, game } so caller can decide to end early.
export const recordAnswer = async (minigameId, userId, username, answer) => {
    const game = await Minigame.findById(minigameId);
    if (!game || game.status !== 'active') return null;

    game.participantCount += 1;
    let isWinner = false;

    if (game.type === 'song_guesser' || game.type === 'lyric_fill') {
        // First-come-first-serve correct answer
        if (!game.winner?.userId && answer.trim().toLowerCase() === game.config.answer?.toLowerCase()) {
            game.winner = { userId, username, answer };
            isWinner = true;
        }
    } else if (game.type === 'trivia') {
        const answerNum = parseInt(answer, 10);
        if (!game.winner?.userId && answerNum === game.config.correctOption) {
            game.winner = { userId, username, answer };
            isWinner = true;
        }
    }
    // skip_battle: pure vote count, handled separately in socket.js

    await game.save();
    return { isWinner, game };
};

export const completeGame = async (minigameId) => {
    return Minigame.findByIdAndUpdate(
        minigameId,
        { $set: { status: 'completed', completedAt: new Date() } },
        { new: true }
    );
};
