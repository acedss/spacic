// cron.js — nightly analytics rollup (runs at 00:05 UTC daily).
// Reads yesterday's ListenEvents → writes SongDailyStat + UserDailyStat.
// This keeps admin charts and Wrapped fast — reads hit rollup collection, not raw events.

import cron from 'node-cron';
import mongoose from 'mongoose';
import { ListenEvent }    from '../models/listenEvent.model.js';
import { SongDailyStat }  from '../models/songDailyStat.model.js';
import { UserDailyStat }  from '../models/userDailyStat.model.js';

// ── Core rollup logic (exported so it can also be called manually / from a script) ──

export const runDailyRollup = async (dateStr) => {
    // dateStr: 'YYYY-MM-DD' UTC. Defaults to yesterday.
    if (!dateStr) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 1);
        dateStr = d.toISOString().slice(0, 10);
    }

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

    console.log(`[cron] Rolling up analytics for ${dateStr}…`);

    // ── Song rollup ────────────────────────────────────────────────────────────

    const songAgg = await ListenEvent.aggregate([
        { $match: { playedAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: {
            _id:          '$songId',
            streams:      { $sum: { $cond: ['$countedStream', 1, 0] } },
            plays:        { $sum: 1 },
            skips:        { $sum: { $cond: ['$wasSkipped', 1, 0] } },
            listeners:    { $addToSet: '$userId' },
            totalMs:      { $sum: '$listenedMs' },
            countries:    { $push: { country: '$country', counted: '$countedStream' } },
            hours:        { $push: { hour: '$hour', counted: '$countedStream' } },
        }},
        { $project: {
            streams:   1,
            plays:     1,
            skips:     1,
            listeners: { $size: '$listeners' },
            avgListenMs: { $cond: [{ $gt: ['$plays', 0] }, { $divide: ['$totalMs', '$plays'] }, 0] },
            countries: 1,
            hours:     1,
        }},
    ]);

    const songOps = songAgg.map(row => {
        // Top countries
        const countryCounts = {};
        for (const { country, counted } of row.countries) {
            if (country && counted) countryCounts[country] = (countryCounts[country] ?? 0) + 1;
        }
        const topCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([country, streams]) => ({ country, streams }));

        // Peak hour
        const hourCounts = {};
        for (const { hour, counted } of row.hours) {
            if (hour != null && counted) hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
        }
        const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return {
            updateOne: {
                filter: { songId: row._id, date: dateStr },
                update: { $set: {
                    streams:      row.streams,
                    plays:        row.plays,
                    skips:        row.skips,
                    listeners:    row.listeners,
                    avgListenMs:  Math.round(row.avgListenMs),
                    topCountries,
                    peakHour:     peakHour != null ? Number(peakHour) : null,
                }},
                upsert: true,
            },
        };
    });

    if (songOps.length) await SongDailyStat.bulkWrite(songOps, { ordered: false });

    // ── User rollup ────────────────────────────────────────────────────────────

    const userAgg = await ListenEvent.aggregate([
        { $match: { playedAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: {
            _id:      '$userId',
            totalMs:  { $sum: '$listenedMs' },
            streams:  { $sum: { $cond: ['$countedStream', 1, 0] } },
            plays:    { $sum: 1 },
            songs:    { $push: { songId: '$songId', title: '$songTitle', artist: '$artistName', counted: '$countedStream', ms: '$listenedMs' } },
            hours:    { $push: { hour: '$hour', counted: '$countedStream' } },
        }},
    ]);

    const userOps = userAgg.map(row => {
        // Top songs
        const songMap = {};
        for (const s of row.songs) {
            const key = s.songId.toString();
            if (!songMap[key]) songMap[key] = { songId: s.songId, title: s.title, artistName: s.artist, streams: 0, totalMs: 0 };
            if (s.counted) songMap[key].streams += 1;
            songMap[key].totalMs += s.ms;
        }
        const topSongs = Object.values(songMap).sort((a, b) => b.streams - a.streams).slice(0, 5);

        // Top artists
        const artistMap = {};
        for (const s of row.songs) {
            if (!s.artist) continue;
            if (!artistMap[s.artist]) artistMap[s.artist] = { artistName: s.artist, streams: 0, totalMs: 0 };
            if (s.counted) artistMap[s.artist].streams += 1;
            artistMap[s.artist].totalMs += s.ms;
        }
        const topArtists = Object.values(artistMap).sort((a, b) => b.streams - a.streams).slice(0, 3);

        // Peak hour
        const hourCounts = {};
        for (const { hour, counted } of row.hours) {
            if (hour != null && counted) hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
        }
        const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return {
            updateOne: {
                filter: { userId: row._id, date: dateStr },
                update: { $set: {
                    totalMs:    row.totalMs,
                    streams:    row.streams,
                    plays:      row.plays,
                    topSongs,
                    topArtists,
                    peakHour:   peakHour != null ? Number(peakHour) : null,
                }},
                upsert: true,
            },
        };
    });

    if (userOps.length) await UserDailyStat.bulkWrite(userOps, { ordered: false });

    console.log(`[cron] Rollup done — ${songOps.length} songs, ${userOps.length} users for ${dateStr}`);
};

// ── Schedule ─────────────────────────────────────────────────────────────────
// Runs at 00:05 UTC every day. The 5-minute offset lets any late-night events
// finish writing before aggregation reads them.

export const initCron = () => {
    cron.schedule('5 0 * * *', () => {
        runDailyRollup().catch(err =>
            console.error('[cron] Rollup failed:', err.message)
        );
    }, { timezone: 'UTC' });

    console.log('[cron] Nightly analytics rollup scheduled (00:05 UTC)');
};
