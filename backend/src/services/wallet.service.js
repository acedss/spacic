// Service: Wallet — top-ups via Stripe, donations via in-app balance
// All balance amounts in credits (1 credit = $0.01 USD = 1 Stripe cent)

import { stripe } from "../lib/stripe.js";
import { User } from "../models/user.model.js";
import { Room } from "../models/room.model.js";
import { Transaction } from "../models/transaction.model.js";

// ── Top-up packages ───────────────────────────────────────────────────────────
// priceInCents = what Stripe charges; credits = what user receives
export const TOPUP_PACKAGES = [
    { id: "starter", label: "Starter",  priceInCents: 500,  credits: 500,  bonus: null },
    { id: "popular", label: "Popular",  priceInCents: 1000, credits: 1100, bonus: "+10%" },
    { id: "value",   label: "Value",    priceInCents: 2500, credits: 2750, bonus: "+10%" },
    { id: "power",   label: "Power",    priceInCents: 5000, credits: 6000, bonus: "+20%" },
];

const getPackage = (packageId) => {
    const pkg = TOPUP_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new Error("Invalid package");
    return pkg;
};

// ── Create Stripe Checkout Session ───────────────────────────────────────────

export const createTopupSession = async (clerkId, packageId, origin) => {
    if (!stripe) throw new Error("Stripe is not configured");

    const user = await User.findOne({ clerkId });
    if (!user) throw new Error("User not found");

    const pkg = getPackage(packageId);

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
                unit_amount: pkg.priceInCents,
                product_data: {
                    name: `Spacic ${pkg.label} Pack`,
                    description: `${pkg.credits.toLocaleString()} credits${pkg.bonus ? ` (${pkg.bonus} bonus)` : ""}`,
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

    // Idempotency: skip if already processed
    const existing = await Transaction.findOne({
        stripeSessionId: session.id,
        status: "completed",
    });
    if (existing) return { received: true };

    const { transactionId, userId, credits } = session.metadata;
    const creditsToAdd = parseInt(credits, 10);

    // Mark transaction completed + credit balance atomically-ish
    // (MongoDB doesn't support multi-doc transactions without a replica set,
    //  but idempotency check above prevents double crediting on retries)
    await Transaction.findByIdAndUpdate(transactionId, { status: "completed" });
    await User.findByIdAndUpdate(userId, { $inc: { balance: creditsToAdd } });

    console.log(`[Wallet] Credited ${creditsToAdd} credits to user ${userId}`);
    return { received: true };
};

// ── Get Balance + Recent Transactions ────────────────────────────────────────

export const getWallet = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select("balance fullName");
    if (!user) throw new Error("User not found");

    const transactions = await Transaction.find({ userId: user._id, status: "completed" })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("roomId", "title");

    return { balance: user.balance, transactions };
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
