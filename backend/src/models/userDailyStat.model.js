import mongoose from 'mongoose';

// Pre-aggregated daily listening stats per user — written by the nightly cron rollup.
// Powers "Wrapped"-style features and user stats without scanning ListenEvents.
const userDailyStatSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:     { type: String, required: true },      // 'YYYY-MM-DD' UTC

    totalMs:  { type: Number, default: 0 },          // total listening time (ms)
    streams:  { type: Number, default: 0 },          // countedStream plays
    plays:    { type: Number, default: 0 },          // raw play events

    // Top 5 songs for this user on this day
    topSongs: [{
        songId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
        title:      String,
        artistName: String,
        streams:    Number,
        totalMs:    Number,
    }],

    // Top 3 artists
    topArtists: [{
        artistName: String,
        streams:    Number,
        totalMs:    Number,
    }],

    peakHour: { type: Number, default: null },        // hour of day they listen most
}, { timestamps: false });

userDailyStatSchema.index({ userId: 1, date: -1 }, { unique: true });

export const UserDailyStat = mongoose.model('UserDailyStat', userDailyStatSchema);
