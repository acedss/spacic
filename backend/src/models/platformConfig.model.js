import mongoose from "mongoose";

// Singleton document — always upsert by { key: 'global' }.
// Admin can adjust these via PATCH /admin/config.
const platformConfigSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true },

    // Withdrawal settings
    withdrawFeePercent:   { type: Number, default: 20,   min: 0, max: 100 }, // platform cut %
    minWithdrawWinPoints: { type: Number, default: 2000, min: 1 },           // 2000 wp = $20

    // Exchange rate: how many USD cents per win point
    // Default: 100 wp = $1.00 → 1 wp = 1 cent
    winPointsToUsdCents:  { type: Number, default: 1, min: 0 },

    // Revenue tracking (accumulates on every withdrawal_fee transaction)
    totalWithdrawalRevenueUsdCents: { type: Number, default: 0 },
}, { timestamps: true });

export const PlatformConfig = mongoose.model("PlatformConfig", platformConfigSchema);

// Convenience: always returns the singleton, creating it if missing
export const getConfig = async () => {
    let cfg = await PlatformConfig.findOne({ key: 'global' });
    if (!cfg) cfg = await PlatformConfig.create({ key: 'global' });
    return cfg;
};
