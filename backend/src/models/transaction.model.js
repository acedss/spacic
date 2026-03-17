import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["topup", "donation"],
        required: true,
    },
    amount: {
        type: Number,
        required: true, // in credits (1 credit = $0.01)
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
    // Top-up only: Stripe checkout session ID for idempotency + audit
    stripeSessionId: {
        type: String,
        default: null,
        index: true,
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
