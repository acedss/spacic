import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    clerkId: {
        type: String,
        required: true,
        unique: true,
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN", "CREATOR"],
        default: "USER",
    },
    userTier: {
        type: String,
        enum: ["FREE", "PREMIUM", "CREATOR"],
        default: "FREE",
    },
    balance: {
        type: Number,
        default: 0,
    },
    stripeCustomerId: {
        type: String,
        default: null,
        index: { unique: true, sparse: true },
    },
    // Lifetime creator stats — accumulated across all rooms on close
    creatorStats: {
        totalRoomsHosted:      { type: Number, default: 0 },
        totalStreams:          { type: Number, default: 0 }, // unique listener joins
        totalMinutesListened:  { type: Number, default: 0 }, // sum of all listener durations
        totalCoinsEarned:      { type: Number, default: 0 }, // goal_payout coins received
        totalUniqueDonors:     { type: Number, default: 0 }, // approximate (union across rooms)
        lastLiveAt:            { type: Date,   default: null },
    },
}, { timestamps: true }
);

export const User = mongoose.model("User", userSchema);