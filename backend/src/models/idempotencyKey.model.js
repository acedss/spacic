// IdempotencyKey — persistent dedup record for "important" operations.
// Differs from Redis-based `once()` because:
//   - survives Redis flush/restart
//   - stores the original response so retries return identical output
//   - has audit value: you can query "did we ever process key X?"
//
// Used by admin gift-coins, manual balance adjustments, and any flow where
// the operation must be provably "exactly once" across days, not minutes.
import mongoose from 'mongoose';

const idempotencyKeySchema = new mongoose.Schema({
    key:    { type: String, required: true },
    scope:  { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    // TTL index — Mongo auto-purges expired docs every ~60s.
    // expireAfterSeconds: 0 means "delete when the value of `expiresAt` is in the past".
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

idempotencyKeySchema.index({ key: 1, scope: 1 }, { unique: true });

export const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
