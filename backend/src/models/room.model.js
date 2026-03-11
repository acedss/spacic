import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
        enum: ["active", "closing", "closed"],
        default: "active",
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
        // Time-based anchor: the Unix ms timestamp at which position 0 of the current song occurred.
        // currentPosition = Date.now() - startTimeUnix (while playing).
        // Persisted so room survives server restarts.
        startTimeUnix: { type: Number, default: null },
        pausedAtMs: { type: Number, default: 0 },
        lastSyncAt: { type: Date, default: null },
    },
    lifecycle: {
        disconnectedAt: { type: Date, default: null },
        closingAt: { type: Date, default: null },
        closedAt: { type: Date, default: null },
    },
    // kept for donation sprint
    streamGoal: { type: Number, default: 0 },
    streamGoalCurrent: { type: Number, default: 0 },
    statsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RoomStats",
        default: null,
    },
}, { timestamps: true });

roomSchema.index({ status: 1, isPublic: 1 });
roomSchema.index({ creatorId: 1 });
roomSchema.index({ "lifecycle.closingAt": 1 }, { sparse: true });

export const Room = mongoose.model("Room", roomSchema);
