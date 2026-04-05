import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true, // One permanent room per creator (Twitch-channel model)
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    status: {
        type: String,
        enum: ["offline", "live"],
        default: "offline",
    },
    isPublic: {
        type: Boolean,
        default: true,
    },
    capacity: {
        type: Number,
        required: true,
    },
    voteThresholdPercent: {
        type: Number,
        default: 50,
    },
    playlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
    }],
    playback: {
        currentSongIndex: { type: Number, default: 0 },
        startTimeUnix:    { type: Number, default: null },
        pausedAtMs:       { type: Number, default: 0 },
        lastSyncAt:       { type: Date,   default: null },
    },

    // Set to Date.now() when going live; cleared on goOffline.
    // Used to scope per-session listener/donation aggregations.
    liveAt: { type: Date, default: null },

    // Per-session donation state — resets on each goLive
    streamGoal:        { type: Number, default: 0 },
    streamGoalCurrent: { type: Number, default: 0 },
    escrow:            { type: Number, default: 0 },

    // All-time engagement counter (never resets)
    favoriteCount: { type: Number, default: 0 },

    // Lifetime accumulated stats — updated on each goOffline via $inc
    stats: {
        totalSessions:        { type: Number, default: 0 },
        totalListeners:       { type: Number, default: 0 }, // unique joins across all sessions
        totalMinutesListened: { type: Number, default: 0 }, // sum of all listener durations
        totalCoinsEarned:     { type: Number, default: 0 }, // goal_payout coins received
        totalDonors:          { type: Number, default: 0 }, // approximate union
        peakListeners:        { type: Number, default: 0 }, // max concurrent ever recorded
        topDonors: [{                                       // top 5 all-time (recomputed per session)
            userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name:       String,
            totalCoins: Number,
        }],
        lastLiveAt:    { type: Date, default: null },
        lastOfflineAt: { type: Date, default: null },
    },

    // Session history — one entry pushed per goOffline
    sessions: [{
        startedAt:       Date,
        endedAt:         Date,
        listenerCount:   Number,
        minutesListened: Number,
        coinsEarned:     Number,
        topDonors: [{
            name:       String,
            totalCoins: Number,
        }],
    }],
}, { timestamps: true });

roomSchema.index({ status: 1, isPublic: 1 });
roomSchema.index({ "stats.lastLiveAt": -1 }, { sparse: true });

export const Room = mongoose.model("Room", roomSchema);
