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
    stripeSubscriptionId: {
        type: String,
        default: null,
    },
    // Mirrors Stripe subscription status — drives access control + UI banners
    subscriptionStatus: {
        type: String,
        enum: ['active', 'past_due', 'cancel_at_period_end', 'canceled', null],
        default: null,
    },
    // When the current paid period ends (used for cancel_at_period_end grace period)
    currentPeriodEnd: {
        type: Date,
        default: null,
    },
    // Custom handle — searchable, not Clerk username (avoids MFA re-verification)
    username: {
        type: String,
        default: null,
        index: { unique: true, sparse: true },
        match: [/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 lowercase letters, numbers, or underscores'],
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