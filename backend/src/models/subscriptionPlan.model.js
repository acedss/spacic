import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
    slug:                 { type: String, required: true, unique: true }, // 'premium', 'creator'
    name:                 { type: String, required: true },
    tier:                 { type: String, enum: ['PREMIUM', 'CREATOR'], required: true },
    priceMonthlyUsd:      { type: Number, required: true }, // cents: 999 = $9.99/mo
    priceYearlyUsd:       { type: Number, default: null },  // cents, null = no yearly option
    stripePriceIdMonthly: { type: String, default: null },  // set after Stripe sync (admin)
    stripePriceIdYearly:  { type: String, default: null },
    stripeProductId:      { type: String, default: null },
    features:             { type: [String], default: [] },
    roomCapacity:         { type: Number, required: true },
    isActive:             { type: Boolean, default: true },
    sortOrder:            { type: Number, default: 0 },
}, { timestamps: true });

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
