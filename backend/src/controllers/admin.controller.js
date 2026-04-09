import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { TopupPackage } from '../models/topupPackage.model.js';
import { User } from '../models/user.model.js';
import { Song } from '../models/song.model.js';
import { Transaction } from '../models/transaction.model.js';
import { SongPlay } from '../models/songPlay.model.js';
import { ListenEvent } from '../models/listenEvent.model.js';
import { SongDailyStat } from '../models/songDailyStat.model.js';
import { redis } from '../lib/redis.js';
import s3Config from '../lib/s3.js';

export const checkAdmin = async (req, res) => res.json({ admin: true });

// ── Plans ─────────────────────────────────────────────────────────────────────

export const getPlans = async (req, res, next) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ sortOrder: 1 });
        res.json({ success: true, data: plans });
    } catch (e) { next(e); }
};

export const updatePlan = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const allowed = ['stripePriceIdMonthly', 'stripePriceIdYearly', 'stripeProductId',
                         'isActive', 'features', 'priceMonthlyUsd', 'priceYearlyUsd', 'name'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                // Coerce empty string to null for ID fields
                update[key] = (key.startsWith('stripe') && req.body[key] === '') ? null : req.body[key];
            }
        }

        const plan = await SubscriptionPlan.findOneAndUpdate({ slug }, { $set: update }, { new: true });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        await redis.del('plans:active');
        res.json({ success: true, data: plan });
    } catch (e) { next(e); }
};

// ── TopupPackages ─────────────────────────────────────────────────────────────

export const getTopupPackages = async (req, res, next) => {
    try {
        const packages = await TopupPackage.find().sort({ sortOrder: 1 });
        res.json({ success: true, data: packages });
    } catch (e) { next(e); }
};

export const createTopupPackage = async (req, res, next) => {
    try {
        const { packageId, name, priceUsd, credits, bonusPercent = 0, isFeatured = false, sortOrder = 0 } = req.body;
        if (!packageId || !name || !priceUsd || !credits) {
            return res.status(400).json({ message: 'packageId, name, priceUsd, credits are required' });
        }
        const pkg = await TopupPackage.create({ packageId, name, priceUsd, credits, bonusPercent, isFeatured, sortOrder });
        await redis.del('packages:active');
        res.status(201).json({ success: true, data: pkg });
    } catch (e) { next(e); }
};

export const updateTopupPackage = async (req, res, next) => {
    try {
        const allowed = ['name', 'priceUsd', 'credits', 'bonusPercent', 'isActive', 'isFeatured', 'sortOrder'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) update[key] = req.body[key];
        }
        const pkg = await TopupPackage.findOneAndUpdate(
            { packageId: req.params.packageId },
            { $set: update },
            { new: true }
        );
        if (!pkg) return res.status(404).json({ message: 'Package not found' });
        await redis.del('packages:active');
        res.json({ success: true, data: pkg });
    } catch (e) { next(e); }
};

export const deleteTopupPackage = async (req, res, next) => {
    try {
        const pkg = await TopupPackage.findOneAndDelete({ packageId: req.params.packageId });
        if (!pkg) return res.status(404).json({ message: 'Package not found' });
        await redis.del('packages:active');
        res.json({ success: true });
    } catch (e) { next(e); }
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = async (req, res, next) => {
    try {
        const { search = '', page = 1 } = req.query;
        const limit = 25;
        const skip = (Number(page) - 1) * limit;

        const query = search
            ? { $or: [
                { fullName:  { $regex: search, $options: 'i' } },
                { username:  { $regex: search, $options: 'i' } },
                { clerkId: search },
            ]}
            : {};

        const [users, total] = await Promise.all([
            User.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('clerkId fullName username imageUrl userTier role subscriptionStatus stripeSubscriptionId stripeCustomerId currentPeriodEnd balance createdAt'),
            User.countDocuments(query),
        ]);

        res.json({ success: true, data: { users, total, page: Number(page), pages: Math.ceil(total / limit) } });
    } catch (e) { next(e); }
};

export const updateUserTier = async (req, res, next) => {
    try {
        const { clerkId } = req.params;
        const { tier } = req.body;
        if (!['FREE', 'PREMIUM', 'CREATOR'].includes(tier)) {
            return res.status(400).json({ message: 'Invalid tier' });
        }

        const user = await User.findOneAndUpdate(
            { clerkId },
            { $set: { userTier: tier } },
            { new: true }
        ).select('clerkId fullName userTier');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ success: true, data: user });
    } catch (e) { next(e); }
};

export const updateUserSubscription = async (req, res, next) => {
    try {
        const { clerkId } = req.params;
        const allowed = ['stripeSubscriptionId', 'stripeCustomerId', 'subscriptionStatus', 'currentPeriodEnd'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) update[key] = req.body[key] || null;
        }
        const user = await User.findOneAndUpdate({ clerkId }, { $set: update }, { new: true })
            .select('clerkId fullName userTier stripeSubscriptionId stripeCustomerId subscriptionStatus currentPeriodEnd');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (e) { next(e); }
};

// ── Songs ─────────────────────────────────────────────────────────────────────

export const getSongs = async (req, res, next) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data: songs });
    } catch (e) { next(e); }
};

export const getSongUploadUrl = async (req, res, next) => {
    try {
        const { filename, contentType } = req.body;
        if (!filename || !contentType) {
            return res.status(400).json({ message: 'filename and contentType required' });
        }

        const s3Key = `songs/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const command = new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: s3Key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(s3Config.client, command, { expiresIn: 300 });
        res.json({ success: true, data: { url, s3Key } });
    } catch (e) { next(e); }
};

export const createSong = async (req, res, next) => {
    try {
        const { title, artist, imageUrl, s3Key, duration } = req.body;
        if (!title || !artist || !imageUrl || !s3Key || !duration) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const song = await Song.create({ title, artist, imageUrl, s3Key, duration });
        res.status(201).json({ success: true, data: song });
    } catch (e) { next(e); }
};

export const deleteSong = async (req, res, next) => {
    try {
        const song = await Song.findByIdAndDelete(req.params.id);
        if (!song) return res.status(404).json({ message: 'Song not found' });
        res.json({ success: true });
    } catch (e) { next(e); }
};

// ── Analytics (chart data) ────────────────────────────────────────────────────

export const getAnalytics = async (req, res, next) => {
    try {
        const days  = Math.min(parseInt(req.query.days ?? '30', 10), 90);
        const since = new Date(Date.now() - days * 86_400_000);

        const [dailyRevenue, dailySignups, topArtists, tierDist, donationsByDay] = await Promise.all([
            // Credits topped up per day
            Transaction.aggregate([
                { $match: { type: 'topup', status: 'completed', createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, revenue: { $sum: '$amount' }, txns: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', revenue: 1, txns: 1 } },
            ]),
            // New users per day
            User.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', count: 1 } },
            ]),
            // Top 8 artists by song count
            Song.aggregate([
                { $group: { _id: '$artist', songs: { $sum: 1 } } },
                { $sort: { songs: -1 } },
                { $limit: 8 },
                { $project: { _id: 0, artist: '$_id', songs: 1 } },
            ]),
            // Users by tier
            User.aggregate([
                { $group: { _id: '$userTier', count: { $sum: 1 } } },
                { $project: { _id: 0, tier: '$_id', count: 1 } },
            ]),
            // Donations per day
            Transaction.aggregate([
                { $match: { type: 'donation', status: 'completed', createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', amount: 1, count: 1 } },
            ]),
        ]);

        res.json({ success: true, data: { dailyRevenue, dailySignups, topArtists, tierDist, donationsByDay, days } });
    } catch (e) { next(e); }
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = async (req, res, next) => {
    try {
        const [tierCounts, activeSubscribers, songCount, recentTopups, revenueAgg] = await Promise.all([
            User.aggregate([{ $group: { _id: '$userTier', count: { $sum: 1 } } }]),
            User.countDocuments({ subscriptionStatus: 'active' }),
            Song.countDocuments(),
            Transaction.find({ type: 'topup', status: 'completed' })
                .sort({ createdAt: -1 })
                .limit(8)
                .populate('userId', 'fullName imageUrl'),
            Transaction.aggregate([
                { $match: { type: 'topup', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        const tiers = { FREE: 0, PREMIUM: 0, CREATOR: 0 };
        tierCounts.forEach(t => { if (t._id) tiers[t._id] = t.count; });

        res.json({ success: true, data: {
            users:              tiers,
            totalUsers:         Object.values(tiers).reduce((a, b) => a + b, 0),
            activeSubscribers,
            songCount,
            totalCreditsToppedup: revenueAgg[0]?.total ?? 0,
            recentTopups,
        }});
    } catch (e) { next(e); }
};

// ── Song Analytics ────────────────────────────────────────────────────────────

export const getSongAnalytics = async (req, res, next) => {
    try {
        const days  = Math.min(parseInt(req.query.days ?? '30', 10), 90);
        const since = new Date(Date.now() - days * 86_400_000);

        const [playsPerDay, topSongs, skipRates, geoBreakdown] = await Promise.all([

            // Daily play count from SongPlay (room-level, one per transition)
            SongPlay.aggregate([
                { $match: { startedAt: { $gte: since } } },
                { $group: {
                    _id:    { $dateToString: { format: '%m/%d', date: '$startedAt' } },
                    plays:  { $sum: 1 },
                    streams: { $sum: '$streamListeners' },
                }},
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', plays: 1, streams: 1 } },
            ]),

            // Top 10 songs by total streamCount (uses denormalized counter — O(1))
            Song.find({ streamCount: { $gt: 0 } })
                .sort({ streamCount: -1 })
                .limit(10)
                .select('title artist streamCount uniquePlays skipCount')
                .lean(),

            // Skip rate per song (skips / uniquePlays) — only songs with >= 3 plays
            Song.find({ uniquePlays: { $gte: 3 } })
                .sort({ skipCount: -1 })
                .limit(10)
                .select('title artist uniquePlays skipCount')
                .lean()
                .then(songs => songs.map(s => ({
                    title:    s.title,
                    artist:   s.artist,
                    skipRate: Math.round((s.skipCount / s.uniquePlays) * 100),
                }))),

            // Geo breakdown of streams (from ListenEvent, last N days)
            ListenEvent.aggregate([
                { $match: { playedAt: { $gte: since }, countedStream: true, country: { $ne: null } } },
                { $group: { _id: '$country', streams: { $sum: 1 } } },
                { $sort: { streams: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, country: '$_id', streams: 1 } },
            ]),
        ]);

        res.json({ success: true, data: { playsPerDay, topSongs, skipRates, geoBreakdown, days } });
    } catch (e) { next(e); }
};
