import mongoose from 'mongoose';

// Per-user listen record — one document per listener per song play.
// Does NOT store startedAt/endedAt (those live on SongPlay to avoid duplication).
// Only stores listenedMs — the computed delta for this listener.
const listenEventSchema = new mongoose.Schema({
    // Core
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    songPlayId:    { type: mongoose.Schema.Types.ObjectId, ref: 'SongPlay', required: true },
    listenedMs:    { type: Number,  required: true },      // actual ms heard (no timestamps)
    countedStream: { type: Boolean, default: false },      // listenedMs >= 30 000
    wasSkipped:    { type: Boolean, default: false },

    // Denormalized for aggregation — pre-computed at write, no joins needed on read
    songId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    artistName:    { type: String, default: null },
    songTitle:     { type: String, default: null },
    hour:          { type: Number, default: null },        // 0–23, from SongPlay.startedAt
    dayOfWeek:     { type: Number, default: null },        // 0–6

    // Location — copied from Listener.country/region/city at write time
    country:       { type: String, default: null },
    region:        { type: String, default: null },
    city:          { type: String, default: null },

    // playedAt = SongPlay.startedAt copied here so TTL + time-range queries work
    // without joining to SongPlay (timestamps: false keeps _id lean)
    playedAt:      { type: Date, required: true },
}, { timestamps: false });

// Reads: user history, user top artists, song stream counts, geo breakdown
listenEventSchema.index({ userId: 1, songPlayId: 1 }, { unique: true }); // dedup
listenEventSchema.index({ userId: 1, countedStream: 1 });
listenEventSchema.index({ userId: 1, artistName: 1 });
listenEventSchema.index({ songId: 1, countedStream: 1 });
listenEventSchema.index({ country: 1, songId: 1 });
listenEventSchema.index({ hour: 1, dayOfWeek: 1, country: 1 });
// TTL: auto-delete raw events after 90 days — rollups keep the aggregated history
listenEventSchema.index({ playedAt: 1 }, { expireAfterSeconds: 7_776_000 });

export const ListenEvent = mongoose.model('ListenEvent', listenEventSchema);
