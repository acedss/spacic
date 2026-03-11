import mongoose from "mongoose";

const roomStatsSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
    },
    totalListeners: {
        type: Number,
        default: 0,
    },
    totalDonations: {
        type: Number,
        default: 0,
    },
    lastLiveAt: {
        type: Date,
        default: null,
    },
    sessions: [{
        startedAt: Date,
        endedAt: Date,
        listenerCount: Number,
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

export const RoomStats = mongoose.model("RoomStats", roomStatsSchema);
