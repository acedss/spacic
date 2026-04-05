// Sync Stripe Price IDs into the SubscriptionPlan collection.
// Run after creating products/prices in Stripe Dashboard:
//   npm run sync-prices
//
// Required env vars:
//   STRIPE_PREMIUM_PRICE_MONTHLY, STRIPE_PREMIUM_PRICE_YEARLY (optional)
//   STRIPE_CREATOR_PRICE_MONTHLY, STRIPE_CREATOR_PRICE_YEARLY (optional)

import 'dotenv/config';
import { connectDB } from '../lib/db.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { redis } from '../lib/redis.js';

await connectDB();

const updates = [
    {
        slug: 'premium',
        stripePriceIdMonthly: process.env.STRIPE_PREMIUM_PRICE_MONTHLY || null,
        stripePriceIdYearly:  process.env.STRIPE_PREMIUM_PRICE_YEARLY  || null,
    },
    {
        slug: 'creator',
        stripePriceIdMonthly: process.env.STRIPE_CREATOR_PRICE_MONTHLY || null,
        stripePriceIdYearly:  process.env.STRIPE_CREATOR_PRICE_YEARLY  || null,
    },
];

for (const { slug, ...prices } of updates) {
    const plan = await SubscriptionPlan.findOneAndUpdate(
        { slug },
        { $set: prices },
        { new: true },
    );
    if (!plan) {
        console.error(`[syncStripePrices] Plan "${slug}" not found — run npm run seed first`);
        continue;
    }
    const monthly = plan.stripePriceIdMonthly ?? '(not set)';
    const yearly  = plan.stripePriceIdYearly  ?? '(not set)';
    console.log(`[syncStripePrices] ${slug}: monthly=${monthly}  yearly=${yearly}`);
}

// Flush cache so next API call fetches fresh canSubscribeMonthly=true
await redis.del('plans:active');
console.log('[syncStripePrices] Flushed plans:active cache');
await redis.quit();

process.exit(0);
