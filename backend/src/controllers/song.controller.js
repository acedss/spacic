import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";
import { ListenEvent } from "../models/listenEvent.model.js";
import { UserDailyStat } from "../models/userDailyStat.model.js";
import { redis } from "../lib/redis.js";
import { getPresignedUrl } from "../services/s3.services.js";

export const getAllSongs = async (req, res, next) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 }).lean();

        const songsWithUrls = await Promise.all(songs.map(async (song) => ({
            ...song,
            audioUrl: await getPresignedUrl(song.s3Key) 
        })));
        console.log("Fetched songs with URLs:", songsWithUrls);
        res.status(200).json(songsWithUrls);
    } catch (error) {
        next(error);
    }
};

// GET /api/songs/trending — top 10 songs today from Redis sorted set
export const getTrending = async (req, res, next) => {
    try {
        const todayKey = `trending:songs:${new Date().toISOString().slice(0, 10)}`;
        const raw      = await redis.zrevrange(todayKey, 0, 9, 'WITHSCORES');

        if (!raw.length) {
            // Fallback: read from Song.streamCount (all-time) if no Redis data yet
            const songs = await Song.find().sort({ streamCount: -1 }).limit(10)
                .select('title artist imageUrl streamCount').lean();
            return res.json({ success: true, data: songs.map(s => ({ ...s, todayStreams: 0 })) });
        }

        // raw = [songId, score, songId, score, ...] (interleaved)
        const ids    = [];
        const scores = {};
        for (let i = 0; i < raw.length; i += 2) {
            ids.push(raw[i]);
            scores[raw[i]] = parseInt(raw[i + 1]);
        }

        const songs = await Song.find({ _id: { $in: ids } })
            .select('title artist imageUrl streamCount').lean();

        // Sort by today's Redis score (preserves leaderboard order)
        songs.sort((a, b) => (scores[b._id.toString()] ?? 0) - (scores[a._id.toString()] ?? 0));

        res.json({ success: true, data: songs.map(s => ({
            ...s, todayStreams: scores[s._id.toString()] ?? 0,
        }))});
    } catch (e) { next(e); }
};

// GET /api/songs/me/stats — user's listening stats (last 30 days)
// Reads from UserDailyStat rollup if available, falls back to raw ListenEvent scan.
export const getMyStats = async (req, res, next) => {
    try {
        const clerkId = req.auth?.userId;
        const user    = await User.findOne({ clerkId }).select('_id').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const days  = Math.min(parseInt(req.query.days ?? '30', 10), 90);
        const since = new Date(Date.now() - days * 86_400_000);

        // Try rollup first (fast — O(days) reads)
        const rollups = await UserDailyStat.find({
            userId: user._id,
            date:   { $gte: since.toISOString().slice(0, 10) },
        }).lean();

        if (rollups.length) {
            // Merge daily rollups into period summary
            const totalMs  = rollups.reduce((s, r) => s + r.totalMs, 0);
            const streams  = rollups.reduce((s, r) => s + r.streams, 0);

            const songMap = {};
            const artistMap = {};
            for (const r of rollups) {
                for (const s of r.topSongs) {
                    const k = s.songId.toString();
                    if (!songMap[k]) songMap[k] = { ...s, streams: 0, totalMs: 0 };
                    songMap[k].streams += s.streams;
                    songMap[k].totalMs += s.totalMs;
                }
                for (const a of r.topArtists) {
                    if (!artistMap[a.artistName]) artistMap[a.artistName] = { ...a, streams: 0, totalMs: 0 };
                    artistMap[a.artistName].streams += a.streams;
                    artistMap[a.artistName].totalMs += a.totalMs;
                }
            }
            const topSongs   = Object.values(songMap).sort((a, b) => b.streams - a.streams).slice(0, 5);
            const topArtists = Object.values(artistMap).sort((a, b) => b.streams - a.streams).slice(0, 3);

            const hourCounts = {};
            for (const r of rollups) {
                if (r.peakHour != null) hourCounts[r.peakHour] = (hourCounts[r.peakHour] ?? 0) + 1;
            }
            const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

            return res.json({ success: true, data: {
                totalMs, streams, days, topSongs, topArtists,
                peakHour: peakHour != null ? Number(peakHour) : null,
                source: 'rollup',
            }});
        }

        // Fallback: scan raw ListenEvents (no rollup data yet — first day of use)
        const [agg] = await ListenEvent.aggregate([
            { $match: { userId: user._id, playedAt: { $gte: since } } },
            { $group: {
                _id:     null,
                totalMs: { $sum: '$listenedMs' },
                streams: { $sum: { $cond: ['$countedStream', 1, 0] } },
                songs:   { $push: { songId: '$songId', title: '$songTitle', artist: '$artistName', counted: '$countedStream', ms: '$listenedMs' } },
            }},
        ]);

        if (!agg) return res.json({ success: true, data: { totalMs: 0, streams: 0, days, topSongs: [], topArtists: [], peakHour: null, source: 'raw' } });

        const songMap = {};
        const artistMap = {};
        for (const s of agg.songs) {
            const k = s.songId.toString();
            if (!songMap[k]) songMap[k] = { songId: s.songId, title: s.title, artistName: s.artist, streams: 0, totalMs: 0 };
            if (s.counted) songMap[k].streams += 1;
            songMap[k].totalMs += s.ms;
            if (s.artist) {
                if (!artistMap[s.artist]) artistMap[s.artist] = { artistName: s.artist, streams: 0, totalMs: 0 };
                if (s.counted) artistMap[s.artist].streams += 1;
                artistMap[s.artist].totalMs += s.ms;
            }
        }

        res.json({ success: true, data: {
            totalMs:    agg.totalMs,
            streams:    agg.streams,
            days,
            topSongs:   Object.values(songMap).sort((a, b) => b.streams - a.streams).slice(0, 5),
            topArtists: Object.values(artistMap).sort((a, b) => b.streams - a.streams).slice(0, 3),
            peakHour:   null,
            source:     'raw',
        }});
    } catch (e) { next(e); }
};

export const getTestSong = async (req, res, next) => {
    try {
        const key = "songs/Edward Sharpe & The Magnetic Zeros - Home (Official Video).mp3";
        const url = await getPresignedUrl(key, 300);
        res.status(200).json({ audioUrl: url });
    } catch (error) {
        next(error);
    }
}