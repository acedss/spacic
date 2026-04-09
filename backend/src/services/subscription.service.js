// Service: Subscriptions — DB-driven plans, Stripe recurring billing
// Plans are cached in Redis (5min TTL). Admin edits → DEL plans:active.

import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { User } from '../models/user.model.js';
import { redis } from '../lib/redis.js';
import { stripe } from '../lib/stripe.js';

const PLANS_CACHE_KEY = 'plans:active';
const PLANS_TTL_S = 300; // 5 minutes

const toClientShape = (doc) => ({
    slug: doc.slug,
    name: doc.name,
    tier: doc.tier,
    priceMonthlyUsd: doc.priceMonthlyUsd,
    priceYearlyUsd: doc.priceYearlyUsd,
    features: doc.features,
    roomCapacity: doc.roomCapacity,
    sortOrder: doc.sortOrder,
    // Expose whether purchase is available (price synced with Stripe)
    canSubscribeMonthly: !!doc.stripePriceIdMonthly,
    canSubscribeYearly: !!doc.stripePriceIdYearly,
});

export const getActivePlans = async () => {
    const cached = await redis.get(PLANS_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const docs = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    const plans = docs.map(toClientShape);
    await redis.set(PLANS_CACHE_KEY, JSON.stringify(plans), 'EX', PLANS_TTL_S);
    return plans;
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const err = (msg, statusCode = 400) => Object.assign(new Error(msg), { statusCode });

export const getSubscriptionStatus = async (clerkId) => {
    const user = await User.findOne({ clerkId })
        .select('userTier subscriptionStatus currentPeriodEnd stripeSubscriptionId')
        .lean();
    if (!user) throw err('User not found', 404);

    // Fetch billing cycle from Stripe if we have a subscription ID
    let billingCycle = null;
    if (user.stripeSubscriptionId && stripe) {
        try {
            const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
                expand: ['items.data.price'],
            });
            billingCycle = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
        } catch { /* non-critical */ }
    }

    return {
        tier:             user.userTier,
        status:           user.subscriptionStatus ?? null,
        currentPeriodEnd: user.currentPeriodEnd ?? null,
        billingCycle,
        hasStripeSubscription: !!user.stripeSubscriptionId,
    };
};

export const cancelSubscription = async (clerkId) => {
    if (!stripe) throw err('Stripe is not configured', 500);
    const user = await User.findOne({ clerkId }).select('stripeSubscriptionId subscriptionStatus').lean();
    if (!user?.stripeSubscriptionId) throw err('No active Stripe subscription found — contact support', 400);
    if (user.subscriptionStatus === 'cancel_at_period_end') throw err('Subscription is already scheduled for cancellation', 400);

    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    const periodEnd = new Date(sub.current_period_end * 1000);

    await User.findOneAndUpdate({ clerkId }, {
        $set: { subscriptionStatus: 'cancel_at_period_end', currentPeriodEnd: periodEnd }
    });

    return { status: 'cancel_at_period_end', currentPeriodEnd: periodEnd };
};

export const reactivateSubscription = async (clerkId) => {
    if (!stripe) throw err('Stripe is not configured', 500);
    const user = await User.findOne({ clerkId }).select('stripeSubscriptionId subscriptionStatus').lean();
    if (!user?.stripeSubscriptionId) throw err('No subscription found', 400);
    if (user.subscriptionStatus !== 'cancel_at_period_end') throw err('Subscription is not scheduled for cancellation', 400);

    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
    await User.findOneAndUpdate({ clerkId }, { $set: { subscriptionStatus: 'active' } });

    return { status: 'active' };
};

export const createSubscribeSession = async (clerkId, slug, billingCycle) => {
    const origin = FRONTEND_URL;
    if (!stripe) throw new Error('Stripe is not configured');

    const plan = await SubscriptionPlan.findOne({ slug, isActive: true }).lean();
    if (!plan) throw new Error('Plan not found');

    const priceId = billingCycle === 'yearly'
        ? plan.stripePriceIdYearly
        : plan.stripePriceIdMonthly;

    if (!priceId) throw new Error('This plan is not yet available — Stripe price not configured');

    const user = await User.findOne({ clerkId });
    if (!user) throw new Error('User not found');

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
            userId: user._id.toString(),
            clerkId,
            tier: plan.tier,
        },
        success_url: `${origin}/subscription?status=success`,
        cancel_url: `${origin}/subscription?status=cancelled`,
    });

    return { url: session.url };
};
