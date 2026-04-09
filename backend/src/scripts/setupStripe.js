/**
 * setupStripe.js — creates Stripe products + prices and syncs price IDs to MongoDB.
 * Run: node src/scripts/setupStripe.js
 *
 * Safe to run multiple times — always creates new prices (Stripe prices are immutable)
 * and updates MongoDB with the latest price ID.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { redis } from '../lib/redis.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = [
    {
        slug:            'premium',
        stripeName:      'Spacic Premium',
        priceMonthlyUsd: 999,    // $9.99
        priceYearlyUsd:  9588,   // $95.88 (20% off)
    },
    {
        slug:            'creator',
        stripeName:      'Spacic Creator',
        priceMonthlyUsd: 1999,   // $19.99
        priceYearlyUsd:  19188,  // $191.88 (20% off)
    },
];

const getOrCreateProduct = async (name) => {
    const results = await stripe.products.search({ query: `name:"${name}" AND active:"true"`, limit: 1 });
    if (results.data.length > 0) {
        console.log(`  ↩  Reusing product "${name}" (${results.data[0].id})`);
        return results.data[0];
    }
    const product = await stripe.products.create({ name });
    console.log(`  ✓  Created product "${name}" (${product.id})`);
    return product;
};

const createPrice = async (productId, unitAmount, interval) => {
    const price = await stripe.prices.create({
        product:   productId,
        currency:  'usd',
        unit_amount: unitAmount,
        recurring: { interval },
    });
    console.log(`  ✓  Created ${interval} price $${(unitAmount / 100).toFixed(2)} → ${price.id}`);
    return price;
};

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB connected\n');

    for (const plan of PLANS) {
        console.log(`── ${plan.slug.toUpperCase()} ─────────────────────────`);
        const product = await getOrCreateProduct(plan.stripeName);

        const [monthly, yearly] = await Promise.all([
            createPrice(product.id, plan.priceMonthlyUsd, 'month'),
            createPrice(product.id, plan.priceYearlyUsd,  'year'),
        ]);

        const result = await SubscriptionPlan.findOneAndUpdate(
            { slug: plan.slug },
            { $set: {
                stripeProductId:      product.id,
                stripePriceIdMonthly: monthly.id,
                stripePriceIdYearly:  yearly.id,
            }},
            { upsert: true, new: true },
        );
        console.log(`  ✓  MongoDB updated → ${plan.slug} (${result._id})\n`);
    }

    await redis.del('plans:active');
    console.log('✓ Redis cache cleared\n');

    // Print summary of what's now in MongoDB
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1 }).select('slug stripePriceIdMonthly stripePriceIdYearly isActive');
    console.log('── MongoDB SubscriptionPlans ─────────────────────');
    plans.forEach(p => {
        console.log(`  ${p.slug}`);
        console.log(`    monthly: ${p.stripePriceIdMonthly ?? '❌ not set'}`);
        console.log(`    yearly:  ${p.stripePriceIdYearly  ?? '❌ not set'}`);
        console.log(`    active:  ${p.isActive}`);
    });
    console.log('──────────────────────────────────────────────────\n');
    console.log('✅ Done — reload the subscription page.\n');

    await redis.quit();
    await mongoose.disconnect();
    process.exit(0);
};

run().catch(err => {
    console.error('✗ Setup failed:', err.message);
    process.exit(1);
});
