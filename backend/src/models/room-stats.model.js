import mongoose from 'mongoose';

const roomStatsSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },

    // Listener metrics
    totalListeners:       { type: Number, default: 0 }, // unique joins
    peakListeners:        { type: Number, default: 0 }, // max concurrent (from Redis at close)
    totalMinutesListened: { type: Number, default: 0 }, // sum of (leftAt - joinedAt)

    // Donation metrics
    totalCoinsEarned:  { type: Number, default: 0 }, // sum of goal_payout transactions
    totalDonors:       { type: Number, default: 0 }, // unique donor count
    topDonors: [{                                    // top 5 precomputed on close
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name:       String,
        totalCoins: Number,
    }],

    // Engagement
    favoriteCount: { type: Number, default: 0 }, // snapshot at close

    lastLiveAt: { type: Date, default: null },
    closedAt:   { type: Date, default: null },

    // Session history (existing)
    sessions: [{
        startedAt:     Date,
        endedAt:       Date,
        listenerCount: Number,
    }],
}, { timestamps: true });

export const RoomStats = mongoose.model('RoomStats', roomStatsSchema);
