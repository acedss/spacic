import mongoose from 'mongoose';

const topupPackageSchema = new mongoose.Schema({
    packageId:    { type: String, required: true, unique: true }, // 'starter', 'popular', etc.
    name:         { type: String, required: true },
    priceUsd:     { type: Number, required: true },  // cents: 500 = $5.00
    credits:      { type: Number, required: true },
    bonusPercent: { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true },
    isFeatured:   { type: Boolean, default: false }, // "Most Popular" badge
    sortOrder:    { type: Number, default: 0 },
}, { timestamps: true });

export const TopupPackage = mongoose.model('TopupPackage', topupPackageSchema);
