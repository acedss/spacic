// Service: Wallet — top-ups via Stripe, donations via in-app balance
// All balance amounts in credits (1 credit = $0.01 USD = 1 Stripe cent)

import mongoose from "mongoose";
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

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const createTopupSession = async (clerkId, packageId) => {
    const origin = FRONTEND_URL;
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

    // ── One-time top-up ───────────────────────────────────────────────────────
    if (event.type === "checkout.session.completed" && event.data.object.mode === "payment") {
        const session = event.data.object;
        const { transactionId, userId, credits } = session.metadata;
        const creditsToAdd = parseInt(credits, 10);

        // Atomic idempotency: pending → completed in one write (no TOCTOU window)
        const updated = await Transaction.findOneAndUpdate(
            { _id: transactionId, status: "pending" },
            { $set: { status: "completed" } },
            { new: true },
        );
        if (!updated) return { received: true };

        await User.findByIdAndUpdate(userId, { $inc: { balance: creditsToAdd } });
        console.log(`[Wallet] Credited ${creditsToAdd} credits to user ${userId}`);
        return { received: true };
    }

    // ── Subscription activated (Checkout completed) ───────────────────────────
    if (event.type === "checkout.session.completed" && event.data.object.mode === "subscription") {
        const session = event.data.object;
        const { userId, tier } = session.metadata;

        // Retrieve full subscription to get current_period_end
        const sub = await stripe.subscriptions.retrieve(session.subscription);

        await User.findByIdAndUpdate(userId, {
            userTier: tier,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: "active",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
        });
        console.log(`[Subscription] Activated tier=${tier} for user ${userId}`);
        return { received: true };
    }

    // ── Subscription updated (cancel toggle, plan change, renewal) ────────────
    if (event.type === "customer.subscription.updated") {
        const sub = event.data.object;
        const update = { currentPeriodEnd: new Date(sub.current_period_end * 1000) };

        if (sub.cancel_at_period_end) {
            update.subscriptionStatus = "cancel_at_period_end";
        } else if (sub.status === "active") {
            update.subscriptionStatus = "active";
        } else if (sub.status === "past_due") {
            update.subscriptionStatus = "past_due";
        }

        const user = await User.findOneAndUpdate(
            { stripeCustomerId: sub.customer },
            { $set: update },
            { new: true },
        );
        if (user) console.log(`[Subscription] Updated status=${update.subscriptionStatus} for user ${user._id}`);
        return { received: true };
    }

    // ── Renewal payment succeeded ─────────────────────────────────────────────
    if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await User.findOneAndUpdate(
                { stripeCustomerId: invoice.customer },
                { $set: { subscriptionStatus: "active", currentPeriodEnd: new Date(sub.current_period_end * 1000) } },
            );
            console.log(`[Subscription] Renewal paid — customer: ${invoice.customer}`);
        }
        return { received: true };
    }

    // ── Subscription cancelled / expired ──────────────────────────────────────
    if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        const user = await User.findOneAndUpdate(
            { stripeCustomerId: sub.customer },
            { $set: { userTier: "FREE", subscriptionStatus: "canceled", stripeSubscriptionId: null, currentPeriodEnd: null } },
            { new: true },
        );
        if (user) console.log(`[Subscription] Downgraded user ${user._id} to FREE`);
        return { received: true };
    }

    // ── Renewal payment failed — keep access, mark past_due ──────────────────
    if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        await User.findOneAndUpdate(
            { stripeCustomerId: invoice.customer },
            { $set: { subscriptionStatus: "past_due" } },
        );
        console.warn(`[Subscription] Payment failed — customer: ${invoice.customer}, attempt: ${invoice.attempt_count}`);
        return { received: true };
    }

    return { received: true };
};

// ── Get Balance + Recent Transactions ────────────────────────────────────────

const PAGE_SIZE = 20;

export const getWallet = async (clerkId, cursor = null) => {
    const user = await User.findOne({ clerkId }).select("balance fullName userTier");
    if (!user) throw new Error("User not found");

    const query = { userId: user._id, status: "completed" };
    // Cursor: only return transactions with _id < cursor (older than last seen)
    if (cursor) query._id = { $lt: new mongoose.Types.ObjectId(cursor) };

    // Fetch PAGE_SIZE + 1 to know if more pages exist
    const rows = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE + 1)
        .populate("roomId", "title");

    const hasMore = rows.length > PAGE_SIZE;
    const transactions = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? transactions[transactions.length - 1]._id.toString() : null;

    return { balance: user.balance, userTier: user.userTier, transactions, nextCursor, hasMore };
};

// ── Donate to Room ────────────────────────────────────────────────────────────
// All writes run inside a MongoDB session (atomic).
// idempotencyKey (client UUID) prevents double-charge on socket retries.
// Credits go into room.escrow until the stream goal is reached, then released to creator.

export const donateToRoom = async (clerkId, roomId, amount, idempotencyKey) => {
    if (!Number.isInteger(amount) || amount < 100) throw new Error("Minimum donation is 100 credits ($1.00)");
    if (!idempotencyKey) throw new Error("idempotencyKey is required");

    // ── Idempotency check (before opening session) ────────────────────────────
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) {
        // Already processed — return the room's current state without re-charging
        const room = await Room.findById(roomId).select("streamGoal streamGoalCurrent title creatorId");
        const user = await User.findOne({ clerkId }).select("balance fullName");
        return {
            newBalance:         user.balance,
            streamGoal:         room.streamGoal,
            streamGoalCurrent:  room.streamGoalCurrent,
            donor:              { name: user.fullName, amount },
            goalReached:        false,
        };
    }

    // ── Atomic transaction ────────────────────────────────────────────────────
    const session = await mongoose.startSession();
    let result;

    await session.withTransaction(async () => {
        // 1. Deduct donor balance (fails atomically if insufficient)
        const donor = await User.findOneAndUpdate(
            { clerkId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true, session }
        );
        if (!donor) throw new Error("Insufficient balance");

        // 2. Add to room escrow + increment goal counter
        const room = await Room.findByIdAndUpdate(
            roomId,
            { $inc: { escrow: amount, streamGoalCurrent: amount } },
            { new: true, session, select: "streamGoal streamGoalCurrent escrow title creatorId" }
        );
        if (!room) throw new Error("Room not found");

        // 3. Record the donation
        await Transaction.create([{
            userId:          donor._id,
            type:            "donation",
            amount,
            status:          "completed",
            roomId,
            donorName:       donor.fullName,
            idempotencyKey,
        }], { session });

        // 4. Goal reached → release escrow to creator in the same transaction
        let goalReached = false;
        if (room.streamGoal > 0 && room.streamGoalCurrent >= room.streamGoal && room.escrow > 0) {
            const payoutAmount = room.escrow;

            const creator = await User.findByIdAndUpdate(
                room.creatorId,
                { $inc: { balance: payoutAmount } },
                { new: true, session }
            );

            await Room.findByIdAndUpdate(
                roomId,
                { $set: { escrow: 0 } },
                { session }
            );

            await Transaction.create([{
                userId:  room.creatorId,
                type:    "goal_payout",
                amount:  payoutAmount,
                status:  "completed",
                roomId,
            }], { session });

            console.log(`[Donation] Goal reached — paid out ${payoutAmount} credits to creator ${creator?._id}`);
            goalReached = true;
        }

        result = {
            newBalance:        donor.balance,
            streamGoal:        room.streamGoal,
            streamGoalCurrent: room.streamGoalCurrent,
            donor:             { name: donor.fullName, amount },
            goalReached,
        };
    });

    session.endSession();
    return result;
};
