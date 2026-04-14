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
        default: undefined,
        match: [/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 lowercase letters, numbers, or underscores'],
    },

    // ── Win Points ────────────────────────────────────────────────────────────
    // Earned-only currency: minigame prizes + creator stream payouts.
    // Cannot be purchased. Withdrawable to fiat once minimums are met.
    winPoints: { type: Number, default: 0, min: 0 },

    // ── Stripe Connect (creator payouts) ──────────────────────────────────────
    stripeConnectAccountId: { type: String, default: null },
    stripeConnectStatus: {
        type: String,
        enum: [null, 'pending', 'active', 'restricted'],
        default: null,
    },

    // ── Activity stats (used for withdrawal eligibility gate) ────────────────
    // Both listeners and creators accumulate these.
    activityStats: {
        roomsJoined:    { type: Number, default: 0 }, // total room:join events
        gamesPlayed:    { type: Number, default: 0 }, // minigame participations
        donationsMade:  { type: Number, default: 0 }, // coin donations sent
        totalWithdrawn: { type: Number, default: 0 }, // lifetime winPoints withdrawn
    },

    // ── Lifetime creator stats — accumulated across all rooms on close ────────
    creatorStats: {
        totalRoomsHosted:      { type: Number, default: 0 },
        totalStreams:          { type: Number, default: 0 }, // unique listener joins
        totalMinutesListened:  { type: Number, default: 0 }, // sum of all listener durations
        totalWinPointsEarned:  { type: Number, default: 0 }, // stream goal payouts → winPoints
        totalUniqueDonors:     { type: Number, default: 0 }, // approximate (union across rooms)
        lastLiveAt:            { type: Date,   default: null },
    },
}, { timestamps: true }
);

// Optional unique fields should only be indexed when present as strings.
userSchema.index(
    { stripeCustomerId: 1 },
    { name: 'stripeCustomerId_unique_if_string', unique: true, partialFilterExpression: { stripeCustomerId: { $type: 'string' } } },
);
userSchema.index(
    { username: 1 },
    { name: 'username_unique_if_string', unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);

export const User = mongoose.model("User", userSchema);
