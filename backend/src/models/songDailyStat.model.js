import mongoose from 'mongoose';

// Pre-aggregated daily stats per song — written by the nightly cron rollup.
// Powers fast reads for admin charts and trending without scanning ListenEvents.
const songDailyStatSchema = new mongoose.Schema({
    songId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    date:        { type: String, required: true },   // 'YYYY-MM-DD' UTC

    streams:     { type: Number, default: 0 },       // countedStream listeners
    plays:       { type: Number, default: 0 },       // total plays (unique + repeat)
    skips:       { type: Number, default: 0 },
    listeners:   { type: Number, default: 0 },       // unique users who heard it

    // Top countries for this song on this day
    topCountries: [{
        country: String,
        streams: Number,
    }],

    peakHour:    { type: Number, default: null },    // 0–23, hour with most streams
    avgListenMs: { type: Number, default: 0 },       // avg listenedMs across all events
}, { timestamps: false });

songDailyStatSchema.index({ songId: 1, date: -1 }, { unique: true });
songDailyStatSchema.index({ date: -1, streams: -1 }); // "top songs on date X"

export const SongDailyStat = mongoose.model('SongDailyStat', songDailyStatSchema);
