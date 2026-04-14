import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        // topup          — listener buys coins with real money
        // donation       — listener sends coins to creator in a room
        // goal_payout    — stream goal completion → creator receives winPoints
        // minigame_debit — creator funds a game (coins deducted)
        // minigame_win   — winner receives winPoints
        // minigame_refund— no winner → coins returned to creator
        // creator_earning— generic creator winPoints credit
        // withdrawal     — winPoints → fiat via Stripe transfer
        // withdrawal_fee — platform cut on withdrawal (revenue tracking)
        enum: [
            'topup', 'donation', 'goal_payout',
            'minigame_debit', 'minigame_win', 'minigame_refund',
            'creator_earning', 'withdrawal', 'withdrawal_fee',
        ],
        required: true,
    },
    // amount is coins for coin types, winPoints for winPoint types
    amount: {
        type: Number,
        required: true,
    },
    // Currency discriminator — makes queries and display unambiguous
    currency: {
        type: String,
        enum: ['coins', 'winPoints', 'usd_cents'],
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
    // Top-up only: Stripe checkout session ID for idempotency + audit
    // sparse: true → allows multiple null values (donations have no stripeSessionId)
    // unique: true → DB-level guarantee against double-processing the same session
    stripeSessionId: {
        type: String,
        default: null,
        index: { unique: true, sparse: true },
    },
    // Donation idempotency: client-generated UUID prevents double-charge on socket retry.
    // NO default — field must be absent (not null) for sparse index to skip non-donations.
    // sparse: true skips documents where the field doesn't exist; it still indexes null values.
    idempotencyKey: {
        type: String,
        index: { unique: true, sparse: true },
    },
    // Donation only
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        default: null,
    },
    donorName: {
        type: String,
        default: null,
    },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ roomId: 1, type: 1, status: 1 }); // leaderboard queries

export const Transaction = mongoose.model("Transaction", transactionSchema);
