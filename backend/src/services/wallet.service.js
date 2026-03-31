// Service: Wallet — top-ups via Stripe, donations via in-app balance
// All balance amounts in credits (1 credit = $0.01 USD = 1 Stripe cent)

import { stripe } from "../lib/stripe.js";
import { User } from "../models/user.model.js";
import { Room } from "../models/room.model.js";
import { Transaction } from "../models/transaction.model.js";
import { TopupPackage } from "../models/topupPackage.model.js";
import { redis } from "../lib/redis.js";

// ── Top-up packages (DB-driven, Redis-cached) ─────────────────────────────────
// DB fields:  packageId, name, priceUsd (cents), credits, bonusPercent
// API shape:  id, label, priceInCents, credits, bonus (e.g. "+10%" or null)

const PACKAGES_CACHE_KEY = "packages:active";
const PACKAGES_TTL_S = 300; // 5 minutes

const toClientShape = (doc) => ({
    id:           doc.packageId,
    label:        doc.name,
    priceInCents: doc.priceUsd,
    credits:      doc.credits,
    bonus:        doc.bonusPercent > 0 ? `+${doc.bonusPercent}%` : null,
    isFeatured:   doc.isFeatured,
});

export const getActivePackages = async () => {
    const cached = await redis.get(PACKAGES_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const docs = await TopupPackage.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    const packages = docs.map(toClientShape);
    await redis.set(PACKAGES_CACHE_KEY, JSON.stringify(packages), "EX", PACKAGES_TTL_S);
    return packages;
};

const getPackage = async (packageId) => {
    const doc = await TopupPackage.findOne({ packageId, isActive: true }).lean();
    if (!doc) throw new Error("Invalid package");
    return doc;
};
  
// ── Create Stripe Checkout Session ───────────────────────────────────────────

// Allowed redirect origins — prevents attacker from injecting Origin: https://evil.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
const sanitizeOrigin = (origin) =>
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

export const createTopupSession = async (clerkId, packageId, rawOrigin) => {
    const origin = sanitizeOrigin(rawOrigin);
    if (!stripe) throw new Error("Stripe is not configured");

    const user = await User.findOne({ clerkId });
    if (!user) throw new Error("User not found");

    const pkg = await getPackage(packageId);
    const bonusLabel = pkg.bonusPercent > 0 ? ` (+${pkg.bonusPercent}% bonus)` : "";

    // Create a pending transaction first — links Stripe session to our DB record
    const transaction = await Transaction.create({
        userId: user._id,
        type: "topup",
        amount: pkg.credits,
        status: "pending",
    });

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{
            price_data: {
                currency: "usd",
                unit_amount: pkg.priceUsd,
                product_data: {
                    name: `Spacic ${pkg.name} Pack`,
                    description: `${pkg.credits.toLocaleString()} credits${bonusLabel}`,
                },
            },
            quantity: 1,
        }],
        metadata: {
            transactionId: transaction._id.toString(),
            userId: user._id.toString(),
            credits: pkg.credits.toString(),
        },
        success_url: `${origin}/wallet?topup=success`,
        cancel_url: `${origin}/wallet?topup=cancelled`,
    });

    // Attach the Stripe session ID to our transaction record
    await Transaction.findByIdAndUpdate(transaction._id, { stripeSessionId: session.id });

    return { url: session.url };
};

// ── Handle Stripe Webhook ─────────────────────────────────────────────────────
// Called with raw body + Stripe-Signature header.
// Only handles checkout.session.completed — all other events are ignored.

export const handleWebhook = async (rawBody, signature) => {
    if (!stripe) throw new Error("Stripe is not configured");
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not set");

    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
        throw new Error("Invalid webhook signature");
    }

    if (event.type !== "checkout.session.completed") return { received: true };

    const session = event.data.object;
    const { transactionId, userId, credits } = session.metadata;
    const creditsToAdd = parseInt(credits, 10);

    // Atomic idempotency: transition pending → completed in a single write.
    // If status is already 'completed' (Stripe retry), findOneAndUpdate returns null → skip.
    // Eliminates TOCTOU window that existed with separate findOne + findByIdAndUpdate.
    const updated = await Transaction.findOneAndUpdate(
        { _id: transactionId, status: "pending" },
        { $set: { status: "completed" } },
        { new: true },
    );
    if (!updated) return { received: true }; // already processed or not found

    await User.findByIdAndUpdate(userId, { $inc: { balance: creditsToAdd } });

    console.log(`[Wallet] Credited ${creditsToAdd} credits to user ${userId}`);
    return { received: true };
};

// ── Get Balance + Recent Transactions ────────────────────────────────────────

export const getWallet = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select("balance fullName userTier");
    if (!user) throw new Error("User not found");

    const transactions = await Transaction.find({ userId: user._id, status: "completed" })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("roomId", "title");

    return { balance: user.balance, userTier: user.userTier, transactions };
};

// ── Donate to Room ────────────────────────────────────────────────────────────
// Deducts from user balance, increments room streamGoalCurrent, records transaction.
// Returns updated balance + donation record for socket broadcast.

export const donateToRoom = async (clerkId, roomId, amount) => {
    if (!Number.isInteger(amount) || amount < 100) throw new Error("Minimum donation is 100 credits ($1.00)");

    const user = await User.findOneAndUpdate(
        { clerkId, balance: { $gte: amount } }, // atomic: only update if sufficient balance
        { $inc: { balance: -amount } },
        { new: true }
    );
    if (!user) throw new Error("Insufficient balance");

    const room = await Room.findByIdAndUpdate(
        roomId,
        { $inc: { streamGoalCurrent: amount } },
        { new: true, select: "streamGoal streamGoalCurrent title" }
    );
    if (!room) {
        // Rollback balance deduction if room doesn't exist
        await User.findOneAndUpdate({ clerkId }, { $inc: { balance: amount } });
        throw new Error("Room not found");
    }

    await Transaction.create({
        userId: user._id,
        type: "donation",
        amount,
        status: "completed",
        roomId,
        donorName: user.fullName,
    });

    return {
        newBalance: user.balance,
        streamGoal: room.streamGoal,
        streamGoalCurrent: room.streamGoalCurrent,
        donor: { name: user.fullName, amount },
    };
};
