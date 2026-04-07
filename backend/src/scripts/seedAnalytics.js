/**
 * seedAnalytics.js — seeds realistic SongPlay + ListenEvent history (last 30 days).
 * Run: npm run seed:analytics
 *
 * Safe to re-run — clears existing SongPlay + ListenEvent before inserting.
 * Requires: songs + at least one room already in DB (run npm run seed first).
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Song }        from '../models/song.model.js';
import { Room }        from '../models/room.model.js';
import { SongPlay }    from '../models/songPlay.model.js';
import { ListenEvent } from '../models/listenEvent.model.js';

// ── Fake listener pool ────────────────────────────────────────────────────────
// Real users not required for analytics seeds — ObjectIds are enough.
// Geo mirrors a realistic SEA + US + JP audience.

const FAKE_LISTENERS = [
    { id: new mongoose.Types.ObjectId(), country: 'VN', region: 'HN', city: 'Hanoi' },
    { id: new mongoose.Types.ObjectId(), country: 'VN', region: 'HCM', city: 'Ho Chi Minh City' },
    { id: new mongoose.Types.ObjectId(), country: 'VN', region: 'DN', city: 'Da Nang' },
    { id: new mongoose.Types.ObjectId(), country: 'US', region: 'CA', city: 'Los Angeles' },
    { id: new mongoose.Types.ObjectId(), country: 'US', region: 'NY', city: 'New York' },
    { id: new mongoose.Types.ObjectId(), country: 'JP', region: '13', city: 'Tokyo' },
    { id: new mongoose.Types.ObjectId(), country: 'JP', region: '27', city: 'Osaka' },
    { id: new mongoose.Types.ObjectId(), country: 'KR', region: '11', city: 'Seoul' },
    { id: new mongoose.Types.ObjectId(), country: 'SG', region: '01', city: 'Singapore' },
    { id: new mongoose.Types.ObjectId(), country: 'AU', region: 'NSW', city: 'Sydney' },
    { id: new mongoose.Types.ObjectId(), country: 'GB', region: 'ENG', city: 'London' },
    { id: new mongoose.Types.ObjectId(), country: 'DE', region: 'BE', city: 'Berlin' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const rand      = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance    = (pct)      => Math.random() < pct;          // true with pct probability
const pick      = (arr)      => arr[rand(0, arr.length - 1)]; // uniform random pick
const daysAgo   = (n, h = 20, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, m, rand(0, 59), 0);
    return d;
};

// Peak-hour weighting: evenings (19–23) are 3× more likely, afternoons (13–18) 2×, rest 1×
const weightedHour = () => {
    const r = Math.random();
    if (r < 0.50) return rand(19, 23);   // 50% → prime time
    if (r < 0.75) return rand(13, 18);   // 25% → afternoon
    if (r < 0.88) return rand(8,  12);   // 13% → morning
    return rand(0, 7);                   // 12% → late night / early morning
};

// Song popularity weights — The Weeknd songs are more popular in this dataset
const buildWeightedSongs = (songs) => {
    const weights = {
        'The Weeknd':                         5,
        'SZA ft. Travis Scott':               4,
        'The Weeknd, JENNIE & Lily Rose Depp': 3,
        'The Weeknd, Ariana Grande':           3,
        'Kanye West':                         2,
    };
    const pool = [];
    for (const song of songs) {
        const w = weights[song.artist] ?? 1;
        for (let i = 0; i < w; i++) pool.push(song);
    }
    return pool;
};

// ── Core generator ────────────────────────────────────────────────────────────

const generateSongPlay = (song, room, startedAt, wasSkipped) => {
    // Natural end: full duration ± small variance.
    // Skipped: 5–60% through the song.
    const skipFraction  = wasSkipped ? Math.random() * 0.55 + 0.05 : 1.0;
    const totalDurationMs = Math.round(song.duration * 1000 * skipFraction);
    const endedAt       = new Date(startedAt.getTime() + totalDurationMs);

    // 2–12 listeners. Peak hours attract more.
    const hour          = startedAt.getHours();
    const isPrime       = hour >= 19 && hour <= 23;
    const listenerCount = rand(isPrime ? 4 : 2, isPrime ? 12 : 6);

    // Randomly sample unique listeners from the pool
    const shuffled  = [...FAKE_LISTENERS].sort(() => Math.random() - 0.5);
    const listeners = shuffled.slice(0, Math.min(listenerCount, shuffled.length));

    // Per-listener windows
    const windows = listeners.map(l => {
        // Some joined late (0–40% into the song)
        const joinOffsetMs   = chance(0.35) ? rand(0, totalDurationMs * 0.4) : 0;
        const effectiveStart = startedAt.getTime() + joinOffsetMs;

        // Some left early (20% chance)
        const leftEarly      = chance(0.2);
        const effectiveEnd   = leftEarly
            ? startedAt.getTime() + rand(joinOffsetMs, totalDurationMs * 0.9)
            : endedAt.getTime();

        const listenedMs   = Math.max(0, effectiveEnd - effectiveStart);
        const countedStream = listenedMs >= 30_000;
        return { listener: l, listenedMs, countedStream };
    });

    const streamListeners = windows.filter(w => w.countedStream).length;

    return {
        songPlay: {
            songId:          song._id,
            roomId:          room._id,
            startedAt,
            endedAt,
            totalDurationMs,
            wasSkipped,
            presentCount:    listeners.length,
            streamListeners,
            countedStream:   streamListeners > 0,
        },
        windows,
        song,
        startedAt,
    };
};

// ── Main ──────────────────────────────────────────────────────────────────────

const seed = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const [songs, room] = await Promise.all([
        Song.find().lean(),
        Room.findOne().lean(),
    ]);

    if (!songs.length) {
        console.error('✗ No songs found — run npm run seed first.');
        process.exit(1);
    }
    if (!room) {
        console.error('✗ No rooms found — run npm run seed first.');
        process.exit(1);
    }

    console.log(`✓ Found ${songs.length} songs, using room "${room.title}"`);

    // Clear existing analytics data
    const [delPlays, delEvents] = await Promise.all([
        SongPlay.deleteMany({}),
        ListenEvent.deleteMany({}),
    ]);
    console.log(`✓ Cleared ${delPlays.deletedCount} SongPlays, ${delEvents.deletedCount} ListenEvents`);

    // Reset Song counters to 0 before rebuilding
    await Song.updateMany({}, { $set: { streamCount: 0, uniquePlays: 0, skipCount: 0 } });
    console.log('✓ Reset Song analytics counters\n');

    const weightedSongs = buildWeightedSongs(songs);

    const allSongPlays    = [];
    const allListenEvents = [];

    // Accumulators for Song counter bulk-update at the end
    const songCounters = {}; // songId → { streamCount, uniquePlays, skipCount }
    for (const s of songs) {
        songCounters[s._id.toString()] = { streamCount: 0, uniquePlays: 0, skipCount: 0 };
    }

    // Generate 30 days of plays
    // Weekends get more sessions; weekdays get fewer
    for (let day = 29; day >= 0; day--) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const sessionCount = rand(isWeekend ? 5 : 3, isWeekend ? 10 : 7);

        for (let s = 0; s < sessionCount; s++) {
            const song      = pick(weightedSongs);
            const hour      = weightedHour();
            const minute    = rand(0, 59);
            const startedAt = new Date(date);
            startedAt.setHours(hour, minute, rand(0, 59), 0);

            // Skip rate: ~18% chance, slightly higher for long songs
            const skipChance = song.duration > 210 ? 0.22 : 0.15;
            const wasSkipped = chance(skipChance);

            const { songPlay, windows, song: playedSong } = generateSongPlay(
                song, room, startedAt, wasSkipped
            );
            allSongPlays.push(songPlay);

            // Accumulate Song counters
            const ctr = songCounters[playedSong._id.toString()];
            ctr.uniquePlays += 1;
            ctr.streamCount += songPlay.streamListeners;
            if (wasSkipped) ctr.skipCount += 1;

            // Build ListenEvent docs (no startedAt/endedAt — only listenedMs delta)
            for (const { listener, listenedMs, countedStream } of windows) {
                allListenEvents.push({
                    userId:        listener.id,
                    songPlayId:    null, // filled after SongPlay insert below
                    listenedMs,
                    countedStream,
                    wasSkipped,
                    songId:        playedSong._id,
                    artistName:    playedSong.artist,
                    songTitle:     playedSong.title,
                    hour:          startedAt.getHours(),
                    dayOfWeek:     startedAt.getDay(),
                    country:       listener.country,
                    region:        listener.region,
                    city:          listener.city,
                    _playIdx:      allSongPlays.length - 1, // temp: link back to play index
                });
            }
        }
    }

    // Insert all SongPlays and get back their _ids
    console.log(`  Inserting ${allSongPlays.length} SongPlay documents…`);
    const insertedPlays = await SongPlay.insertMany(allSongPlays, { ordered: true });

    // Resolve songPlayId for each ListenEvent using the temp _playIdx
    for (const event of allListenEvents) {
        event.songPlayId = insertedPlays[event._playIdx]._id;
        delete event._playIdx;
    }

    // Bulk insert ListenEvents in chunks of 500 to avoid hitting 16MB doc limit
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < allListenEvents.length; i += CHUNK) {
        await ListenEvent.insertMany(allListenEvents.slice(i, i + CHUNK), { ordered: false });
        inserted += Math.min(CHUNK, allListenEvents.length - i);
    }
    console.log(`  Inserted ${inserted} ListenEvent documents`);

    // Bulk-update Song counters (one write per song, not per play)
    const songUpdates = Object.entries(songCounters).map(([id, ctr]) =>
        Song.findByIdAndUpdate(id, { $inc: ctr })
    );
    await Promise.all(songUpdates);
    console.log(`  Updated stream counters on ${songUpdates.length} songs\n`);

    // Summary
    console.log('── Analytics seed summary ──────────────────────────────────────');
    const topSongs = await Song.find().sort({ streamCount: -1 }).limit(3).lean();
    topSongs.forEach((s, i) =>
        console.log(`  #${i + 1}  "${s.title}" — ${s.streamCount} streams, ${s.uniquePlays} plays, ${s.skipCount} skips`)
    );

    const totalStreams = await ListenEvent.countDocuments({ countedStream: true });
    const geoBreakdown = await ListenEvent.aggregate([
        { $match: { countedStream: true } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
    ]);
    console.log(`\n  Total counted streams: ${totalStreams}`);
    console.log('  Top countries:');
    geoBreakdown.forEach(g => console.log(`    ${g._id}: ${g.count}`));
    console.log('────────────────────────────────────────────────────────────────\n');
    console.log('✅ Analytics seed complete.\n');

    await mongoose.disconnect();
};

seed().catch(err => {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
});
