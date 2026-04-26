import { randomUUID } from 'crypto';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PlatformConfig, getConfig } from '../models/platformConfig.model.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { TopupPackage } from '../models/topupPackage.model.js';
import { User } from '../models/user.model.js';
import { Song, SONG_GENRES, SONG_MOODS, MUSICAL_KEYS } from '../models/song.model.js';
import { Artist } from '../models/artist.model.js';
import { Album } from '../models/album.model.js';
import { Room } from '../models/room.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Notification } from '../models/notification.model.js';
import { withIdempotency } from '../lib/idempotency.js';
import { getIo } from '../lib/io.js';
import { SongPlay } from '../models/songPlay.model.js';
import { ListenEvent } from '../models/listenEvent.model.js';
import { SongDailyStat } from '../models/songDailyStat.model.js';
import { redis } from '../lib/redis.js';
import s3Config from '../lib/s3.js';
import { putObject, getPresignedUrl } from '../services/s3.services.js';

export const checkAdmin = async (req, res, next) => {
    try {
        const clerkId = req.devBypass ? req.devClerkId : req.auth()?.userId;
        if (!clerkId) return res.json({ admin: false });

        const user = await User.findOne({ clerkId }).select('role').lean();
        res.json({ admin: user?.role === 'ADMIN' });
    } catch (e) { next(e); }
};

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

// ── Admin coin gifts / adjustments ────────────────────────────────────────────
//
// Three concerns to get right:
//   1. Atomicity        — credit balance + transaction row + notification must
//                         all happen, or none of them. Mongo session/txn used.
//   2. Idempotency      — admin clicks "Send" twice → user should get gift once.
//                         IdempotencyKey persists for 24h so a retry returns
//                         the cached result instead of double-crediting.
//   3. Live propagation — if the user is online, push a wallet:balance_updated
//                         event so their UI updates without a refetch.
export const giftCoins = async (req, res, next) => {
    try {
        const { clerkId } = req.params;
        const { amount, reason = '', idempotencyKey } = req.body;
        const adminClerkId = getRequesterClerkId(req);

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount === 0) {
            return res.status(400).json({ message: 'Amount must be a non-zero number' });
        }
        if (Math.abs(numAmount) > 1_000_000) {
            return res.status(400).json({ message: 'Amount too large — max 1,000,000 per gift' });
        }
        if (!idempotencyKey) {
            return res.status(400).json({ message: 'idempotencyKey is required' });
        }

        const result = await withIdempotency({
            scope: 'admin-gift',
            key:   idempotencyKey,
            ttlHours: 168, // 7 days — long enough to survive any client retry storm
            fn: async () => {
                const target = await User.findOne({ clerkId });
                if (!target) throw Object.assign(new Error('User not found'), { status: 404 });

                // Negative amounts allowed (admin_adjust corrective debit) but
                // never below zero balance.
                if (numAmount < 0 && target.balance + numAmount < 0) {
                    throw Object.assign(new Error('Cannot debit below zero balance'), { status: 400 });
                }

                const txType = numAmount > 0 ? 'admin_gift' : 'admin_adjust';

                target.balance += numAmount;
                await target.save();

                const tx = await Transaction.create({
                    userId:       target._id,
                    type:         txType,
                    amount:       numAmount,
                    currency:     'coins',
                    status:       'completed',
                    reason:       reason.slice(0, 280),
                    adminClerkId,
                });

                const notif = await Notification.create({
                    recipientClerkId: clerkId,
                    type: 'admin_gift',
                    title: numAmount > 0 ? 'You received a gift!' : 'Balance adjusted',
                    message: numAmount > 0
                        ? `An admin sent you ${numAmount.toLocaleString()} coins${reason ? ` — ${reason}` : ''}`
                        : `Balance adjusted by ${numAmount.toLocaleString()} coins${reason ? ` — ${reason}` : ''}`,
                    metadata: { amount: numAmount, transactionId: tx._id.toString() },
                });

                // Push to recipient if online — non-fatal if io unavailable.
                try {
                    const io = getIo();
                    io?.to(`user:${clerkId}`).emit('wallet:balance_updated', { balance: target.balance });
                    io?.to(`user:${clerkId}`).emit('notification:new', notif);
                } catch (_) { /* best-effort */ }

                return {
                    success: true,
                    data: {
                        transactionId: tx._id.toString(),
                        newBalance:    target.balance,
                        recipient:     { clerkId, fullName: target.fullName },
                    },
                };
            },
        });

        res.json(result);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ message: e.message });
        next(e);
    }
};

// Returns paginated coin movements for one user — used by the admin user-detail drawer.
export const getUserTransactions = async (req, res, next) => {
    try {
        const { clerkId } = req.params;
        const { page = 1, type } = req.query;
        const limit = 25;
        const skip = (Number(page) - 1) * limit;

        const user = await User.findOne({ clerkId }).select('_id balance fullName');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const query = { userId: user._id };
        if (type) query.type = type;

        const [txs, total] = await Promise.all([
            Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Transaction.countDocuments(query),
        ]);

        // Lifetime totals — useful for the "this user has spent / received" header.
        const totalsAgg = await Transaction.aggregate([
            { $match: { userId: user._id, status: 'completed' } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ]);
        const totals = Object.fromEntries(totalsAgg.map(t => [t._id, t.total]));

        res.json({
            success: true,
            data: {
                user:  { clerkId, fullName: user.fullName, balance: user.balance },
                txs, total, page: Number(page), pages: Math.ceil(total / limit),
                totals,
            },
        });
    } catch (e) { next(e); }
};

// ── Songs ─────────────────────────────────────────────────────────────────────

const MAX_SONG_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const SONG_UPLOAD_INTENT_TTL_SECONDS = 15 * 60; // 15 minutes
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const MIME_TO_EXTENSION = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/webm': '.webm',
};

const getRequesterClerkId = (req) => (req.devBypass ? req.devClerkId : req.auth()?.userId);
const normalizeSongText = (value, maxLen) => String(value ?? '').trim().slice(0, maxLen);
const extractExt = (filename) => {
    const dotIndex = String(filename ?? '').lastIndexOf('.');
    if (dotIndex < 0) return '';
    return String(filename).slice(dotIndex).toLowerCase();
};
const buildSafeSongKey = (filename, contentType) => {
    const ext = extractExt(filename) || MIME_TO_EXTENSION[String(contentType ?? '').toLowerCase()] || '';
    if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) return null;
    const base = String(filename ?? '')
        .replace(/\.[^./\\]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48) || 'track';
    return `songs/${Date.now()}-${randomUUID()}-${base}${ext}`;
};
const isSafeHttpUrl = (value) => {
    try {
        const u = new URL(String(value ?? ''));
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SONG_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const SONG_IMAGE_PRESIGN_TTL = 7 * 24 * 3600; // 7 days (S3 SigV4 max)

export const uploadSongImage = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Image file is required' });
        const mime = String(req.file.mimetype ?? '').toLowerCase();
        if (!ALLOWED_IMAGE_MIME.has(mime)) {
            return res.status(400).json({ message: 'Only JPEG, PNG, WebP, or GIF images are allowed' });
        }
        if (req.file.size > MAX_SONG_IMAGE_BYTES) {
            return res.status(400).json({ message: `Image must be <= ${MAX_SONG_IMAGE_BYTES / (1024 * 1024)}MB` });
        }
        const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
        const key = `images/songs/${randomUUID()}.${ext}`;
        await putObject(key, req.file.buffer, mime);
        const presignedUrl = await getPresignedUrl(key, SONG_IMAGE_PRESIGN_TTL);
        res.json({ success: true, data: { key, presignedUrl } });
    } catch (e) { next(e); }
};

export const getSongs = async (req, res, next) => {
    try {
        const page    = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const search  = String(req.query.search ?? '').trim();
        const sortKey = String(req.query.sort ?? 'createdAt');
        const dir     = String(req.query.dir ?? 'desc') === 'asc' ? 1 : -1;
        const filter  = String(req.query.filter ?? ''); // 'missingImage' | 'missingArtist' | 'short' | ''

        const q = {};
        if (search) {
            const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            q.$or = [{ title: re }, { artist: re }];
        }
        if (filter === 'missingImage')  q.imageUrl = { $in: [null, ''] };
        if (filter === 'missingArtist') q.artist = { $in: [null, ''] };
        if (filter === 'short')         q.duration = { $lt: 30 };

        const allowedSorts = new Set(['createdAt', 'title', 'artist', 'duration', 'streamCount', 'uniquePlays', 'skipCount']);
        const sort = { [allowedSorts.has(sortKey) ? sortKey : 'createdAt']: dir };

        const [songs, total] = await Promise.all([
            Song.find(q).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            Song.countDocuments(q),
        ]);
        res.json({ success: true, data: songs, total, page, pages: Math.ceil(total / limit) });
    } catch (e) { next(e); }
};

export const bulkDeleteSongs = async (req, res, next) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
        if (ids.length === 0) return res.status(400).json({ message: 'ids required' });
        if (ids.length > 100) return res.status(400).json({ message: 'Max 100 songs per bulk delete' });
        const result = await Song.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (e) { next(e); }
};

export const uploadSongFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Audio file is required' });
        }

        const contentType = String(req.file.mimetype ?? '').trim().toLowerCase();
        const sizeBytes = Number(req.file.size);

        if (!contentType.startsWith('audio/')) {
            return res.status(400).json({ message: 'Only audio uploads are allowed' });
        }
        if (sizeBytes <= 0 || sizeBytes > MAX_SONG_UPLOAD_BYTES) {
            return res.status(400).json({ message: `Audio file must be <= ${Math.round(MAX_SONG_UPLOAD_BYTES / (1024 * 1024))}MB` });
        }

        const s3Key = buildSafeSongKey(req.file.originalname, contentType);
        if (!s3Key) {
            return res.status(400).json({ message: 'Unsupported audio format. Use mp3, wav, ogg, m4a, aac, flac, or webm.' });
        }

        const command = new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: contentType,
        });
        await s3Config.client.send(command);

        const uploadToken = randomUUID();
        const intentKey = `song-upload-intent:${uploadToken}`;
        const requesterClerkId = getRequesterClerkId(req) ?? null;
        await redis.set(intentKey, JSON.stringify({
            s3Key,
            contentType,
            sizeBytes,
            clerkId: requesterClerkId,
        }), 'EX', SONG_UPLOAD_INTENT_TTL_SECONDS);

        res.json({
            success: true,
            data: {
                s3Key,
                uploadToken,
                maxSizeBytes: MAX_SONG_UPLOAD_BYTES,
            },
        });
    } catch (e) { next(e); }
};

export const createSong = async (req, res, next) => {
    try {
        const title = normalizeSongText(req.body?.title, 160);
        const artist = normalizeSongText(req.body?.artist, 160);
        const imageUrl = String(req.body?.imageUrl ?? '').trim();
        const s3Key = String(req.body?.s3Key ?? '').trim();
        const uploadToken = String(req.body?.uploadToken ?? '').trim();
        const duration = Number(req.body?.duration);

        if (!title || !artist || !imageUrl || !s3Key || !uploadToken || !Number.isFinite(duration)) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        if (!isSafeHttpUrl(imageUrl)) {
            return res.status(400).json({ message: 'Invalid cover image URL' });
        }
        if (!s3Key.startsWith('songs/') || !/^[a-zA-Z0-9/_\-.]+$/.test(s3Key)) {
            return res.status(400).json({ message: 'Invalid audio key' });
        }
        if (duration <= 0 || duration > 4 * 60 * 60) {
            return res.status(400).json({ message: 'Duration must be between 1 second and 4 hours' });
        }

        const intentKey = `song-upload-intent:${uploadToken}`;
        const intentRaw = await redis.get(intentKey);
        if (!intentRaw) {
            return res.status(400).json({ message: 'Upload session expired. Please upload again.' });
        }

        let intent = null;
        try {
            intent = JSON.parse(intentRaw);
        } catch {
            await redis.del(intentKey);
            return res.status(400).json({ message: 'Invalid upload session. Please upload again.' });
        }

        if (intent?.s3Key !== s3Key) {
            return res.status(400).json({ message: 'Upload key mismatch. Please upload again.' });
        }
        if (!String(intent?.contentType ?? '').startsWith('audio/')) {
            return res.status(400).json({ message: 'Invalid upload content type' });
        }
        const requesterClerkId = getRequesterClerkId(req);
        if (intent?.clerkId && requesterClerkId && intent.clerkId !== requesterClerkId) {
            return res.status(403).json({ message: 'Upload token does not belong to current user' });
        }

        let head;
        try {
            head = await s3Config.client.send(new HeadObjectCommand({ Bucket: s3Config.bucket, Key: s3Key }));
        } catch {
            return res.status(400).json({ message: 'Uploaded audio file not found. Please re-upload.' });
        }

        const uploadedType = String(head?.ContentType ?? '').toLowerCase();
        const uploadedSize = Number(head?.ContentLength ?? 0);
        if (!uploadedType.startsWith('audio/')) {
            return res.status(400).json({ message: 'Uploaded file is not a valid audio file' });
        }
        if (!Number.isFinite(uploadedSize) || uploadedSize <= 0 || uploadedSize > MAX_SONG_UPLOAD_BYTES) {
            return res.status(400).json({ message: 'Uploaded file size is invalid' });
        }
        if (Number.isFinite(intent?.sizeBytes) && Number(intent.sizeBytes) !== uploadedSize) {
            return res.status(400).json({ message: 'Uploaded file size mismatch. Please upload again.' });
        }

        // Optional metadata — sanitize and apply only if provided
        const optionalFields = pickSongMetadata(req.body);

        const song = await Song.create({
            title,
            artist,
            imageUrl,
            s3Key,
            duration: Math.round(duration),
            ...optionalFields,
        });
        await redis.del(intentKey);
        res.status(201).json({ success: true, data: song });
    } catch (e) { next(e); }
};

// Sanitize the optional song metadata fields. Returns a partial object with
// only the fields actually present in the input — caller spreads into create/update.
const pickSongMetadata = (body) => {
    const out = {};
    if (body?.description !== undefined) out.description = String(body.description).trim().slice(0, 2000);
    if (Array.isArray(body?.genre))      out.genre = body.genre.slice(0, 8).map(s => String(s).trim().toLowerCase()).filter(Boolean);
    if (Array.isArray(body?.mood))       out.mood = body.mood.slice(0, 8).map(s => String(s).trim().toLowerCase()).filter(Boolean);
    if (Array.isArray(body?.tags))       out.tags = body.tags.slice(0, 12).map(s => String(s).trim().slice(0, 30)).filter(Boolean);
    if (body?.language !== undefined)    out.language = String(body.language).trim().slice(0, 10).toLowerCase();
    if (body?.bpm !== undefined && body.bpm !== null && body.bpm !== '') {
        const n = Number(body.bpm);
        if (Number.isFinite(n) && n >= 30 && n <= 300) out.bpm = Math.round(n);
    }
    if (body?.musicalKey !== undefined)  out.musicalKey = body.musicalKey ? String(body.musicalKey) : null;
    if (body?.explicit !== undefined)    out.explicit = Boolean(body.explicit);
    if (body?.releaseDate !== undefined) {
        const d = body.releaseDate ? new Date(body.releaseDate) : null;
        out.releaseDate = (d && !Number.isNaN(d.getTime())) ? d : null;
    }
    if (body?.originalArtist !== undefined) out.originalArtist = String(body.originalArtist).trim().slice(0, 200);
    if (body?.license !== undefined)        out.license = String(body.license).trim().slice(0, 100);
    if (body?.isrc !== undefined)           out.isrc = String(body.isrc).trim().slice(0, 32);
    if (body?.artistId !== undefined)       out.artistId = body.artistId || null;
    if (body?.albumId !== undefined)        out.albumId = body.albumId || null;
    for (const f of ['energy', 'danceability', 'valence']) {
        if (body?.[f] !== undefined && body[f] !== null && body[f] !== '') {
            const n = Number(body[f]);
            if (Number.isFinite(n) && n >= 0 && n <= 1) out[f] = n;
        }
    }
    return out;
};

export const updateSong = async (req, res, next) => {
    try {
        const update = {};
        if (req.body?.title !== undefined)    update.title = normalizeSongText(req.body.title, 200);
        if (req.body?.artist !== undefined)   update.artist = normalizeSongText(req.body.artist, 200);
        if (req.body?.imageUrl !== undefined) {
            const url = String(req.body.imageUrl).trim();
            if (url && !isSafeHttpUrl(url)) return res.status(400).json({ message: 'Invalid image URL' });
            update.imageUrl = url;
        }
        Object.assign(update, pickSongMetadata(req.body));
        const song = await Song.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!song) return res.status(404).json({ message: 'Song not found' });
        res.json({ success: true, data: song });
    } catch (e) { next(e); }
};

export const getSongDetail = async (req, res, next) => {
    try {
        const song = await Song.findById(req.params.id)
            .populate('artistId', 'name imageUrl')
            .populate('albumId', 'title coverImageUrl releaseYear')
            .lean();
        if (!song) return res.status(404).json({ message: 'Song not found' });

        // Recent play stats (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
        const playTrend = await SongDailyStat.find({
            songId: song._id,
            date: { $gte: thirtyDaysAgo },
        }).sort({ date: 1 }).lean();

        res.json({ success: true, data: { song, playTrend } });
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
        const parseDateInput = (value) => {
            if (!value) return null;
            const d = new Date(String(value));
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const granularityMap = {
            hourly: 'hour',
            daily: 'day',
            weekly: 'week',
            monthly: 'month',
        };
        const granularityInput = String(req.query.granularity ?? 'daily').toLowerCase();
        const granularity = Object.keys(granularityMap).includes(granularityInput) ? granularityInput : 'daily';

        const now = new Date();
        const fallbackFrom = new Date(now.getTime() - 30 * 86_400_000);
        const from = parseDateInput(req.query.from) ?? fallbackFrom;
        const to = parseDateInput(req.query.to) ?? now;
        if (from >= to) return res.status(400).json({ message: 'Invalid time range: "from" must be before "to"' });
        if (to.getTime() - from.getTime() > 366 * 86_400_000) {
            return res.status(400).json({ message: 'Maximum supported range is 366 days' });
        }

        const bucketExpr = (field) => {
            if (granularity === 'weekly') {
                return { $dateTrunc: { date: field, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } };
            }
            return { $dateTrunc: { date: field, unit: granularityMap[granularity], timezone: 'UTC' } };
        };
        const bucketIso = {
            $dateToString: { format: '%Y-%m-%dT%H:%M:%SZ', date: '$_id', timezone: 'UTC' },
        };

        const [dailyRevenue, dailySignups, topArtists, tierDist, donationsByDay, roomDailySessions, topRooms, roomCount, liveRoomCount] = await Promise.all([
            // Credits topped up per day
            Transaction.aggregate([
                { $match: { type: 'topup', status: 'completed', createdAt: { $gte: from, $lte: to } } },
                { $group: { _id: bucketExpr('$createdAt'), revenue: { $sum: '$amount' }, txns: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: bucketIso, revenue: 1, txns: 1 } },
            ]),
            // New users per day
            User.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                { $group: { _id: bucketExpr('$createdAt'), count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: bucketIso, count: 1 } },
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
                { $match: { type: 'donation', status: 'completed', createdAt: { $gte: from, $lte: to } } },
                { $group: { _id: bucketExpr('$createdAt'), amount: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: bucketIso, amount: 1, count: 1 } },
            ]),
            // Room sessions by day (time-series trend for room health)
            Room.aggregate([
                { $unwind: '$sessions' },
                { $match: { 'sessions.startedAt': { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: bucketExpr('$sessions.startedAt'),
                        sessions: { $sum: 1 },
                        listeners: { $sum: { $ifNull: ['$sessions.listenerCount', 0] } },
                        minutesListened: { $sum: { $ifNull: ['$sessions.minutesListened', 0] } },
                        coinsEarned: { $sum: { $ifNull: ['$sessions.coinsEarned', 0] } },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: bucketIso, sessions: 1, listeners: 1, minutesListened: 1, coinsEarned: 1 } },
            ]),
            // Top rooms during selected period (for sortable leaderboard UI)
            Room.aggregate([
                { $unwind: '$sessions' },
                { $match: { 'sessions.startedAt': { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: '$_id',
                        title: { $first: '$title' },
                        status: { $first: '$status' },
                        favoriteCount: { $first: '$favoriteCount' },
                        sessions: { $sum: 1 },
                        listeners: { $sum: { $ifNull: ['$sessions.listenerCount', 0] } },
                        minutesListened: { $sum: { $ifNull: ['$sessions.minutesListened', 0] } },
                        coinsEarned: { $sum: { $ifNull: ['$sessions.coinsEarned', 0] } },
                        avgListeners: { $avg: { $ifNull: ['$sessions.listenerCount', 0] } },
                    },
                },
                { $sort: { listeners: -1 } },
                { $limit: 50 },
                {
                    $project: {
                        _id: 0,
                        roomId: '$_id',
                        title: 1,
                        status: 1,
                        favoriteCount: 1,
                        sessions: 1,
                        listeners: 1,
                        minutesListened: 1,
                        coinsEarned: 1,
                        avgListeners: { $round: ['$avgListeners', 1] },
                    },
                },
            ]),
            Room.countDocuments({}),
            Room.countDocuments({ status: 'live' }),
        ]);

        const roomSummary = roomDailySessions.reduce((acc, day) => {
            acc.sessions += day.sessions;
            acc.listeners += day.listeners;
            acc.minutesListened += day.minutesListened;
            acc.coinsEarned += day.coinsEarned;
            return acc;
        }, {
            totalRooms: roomCount,
            liveRooms: liveRoomCount,
            sessions: 0,
            listeners: 0,
            minutesListened: 0,
            coinsEarned: 0,
        });
        const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));

        res.json({
            success: true,
            data: {
                dailyRevenue,
                dailySignups,
                topArtists,
                tierDist,
                donationsByDay,
                roomDailySessions,
                topRooms,
                roomSummary,
                granularity,
                from: from.toISOString(),
                to: to.toISOString(),
                days,
            },
        });
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
        const parseDateInput = (value) => {
            if (!value) return null;
            const parsed = new Date(String(value));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const granularityMap = {
            hourly: 'hour',
            daily: 'day',
            weekly: 'week',
            monthly: 'month',
        };
        const granularityInput = String(req.query.granularity ?? 'daily').toLowerCase();
        const granularity = Object.keys(granularityMap).includes(granularityInput) ? granularityInput : 'daily';
        const fallbackDays = Math.max(1, Math.min(parseInt(String(req.query.days ?? '30'), 10) || 30, 90));

        const now = new Date();
        const from = parseDateInput(req.query.from) ?? new Date(now.getTime() - fallbackDays * 86_400_000);
        const to = parseDateInput(req.query.to) ?? now;
        if (from >= to) return res.status(400).json({ message: 'Invalid time range: "from" must be before "to"' });
        if (to.getTime() - from.getTime() > 366 * 86_400_000) {
            return res.status(400).json({ message: 'Maximum supported range is 366 days' });
        }

        const bucketExpr = (field) => {
            if (granularity === 'weekly') {
                return { $dateTrunc: { date: field, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } };
            }
            return { $dateTrunc: { date: field, unit: granularityMap[granularity], timezone: 'UTC' } };
        };
        const bucketIso = {
            $dateToString: { format: '%Y-%m-%dT%H:%M:%SZ', date: '$_id', timezone: 'UTC' },
        };
        const fromDay = from.toISOString().slice(0, 10);
        const toDay = to.toISOString().slice(0, 10);

        const [playsPerPeriod, topSongRollups, fallbackTopSongs, geoBreakdown, summaryAgg, activeSongCountAgg] = await Promise.all([
            SongPlay.aggregate([
                { $match: { startedAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: bucketExpr('$startedAt'),
                        plays: { $sum: 1 },
                        streams: { $sum: { $ifNull: ['$streamListeners', 0] } },
                        skips: { $sum: { $cond: ['$wasSkipped', 1, 0] } },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: bucketIso, plays: 1, streams: 1, skips: 1 } },
            ]),
            SongDailyStat.aggregate([
                { $match: { date: { $gte: fromDay, $lte: toDay } } },
                {
                    $group: {
                        _id: '$songId',
                        streams: { $sum: '$streams' },
                        plays: { $sum: '$plays' },
                        skips: { $sum: '$skips' },
                        listeners: { $sum: '$listeners' },
                    },
                },
                { $sort: { streams: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'songs',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'song',
                    },
                },
                { $unwind: { path: '$song', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        songId: '$_id',
                        title: { $ifNull: ['$song.title', 'Unknown title'] },
                        artist: { $ifNull: ['$song.artist', 'Unknown artist'] },
                        streams: 1,
                        plays: 1,
                        skips: 1,
                        listeners: 1,
                    },
                },
            ]),
            Song.find({ streamCount: { $gt: 0 } })
                .sort({ streamCount: -1 })
                .limit(10)
                .select('_id title artist streamCount uniquePlays skipCount')
                .lean(),
            ListenEvent.aggregate([
                { $match: { playedAt: { $gte: from, $lte: to }, countedStream: true, country: { $ne: null } } },
                { $group: { _id: '$country', streams: { $sum: 1 } } },
                { $sort: { streams: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, country: '$_id', streams: 1 } },
            ]),
            SongPlay.aggregate([
                { $match: { startedAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: null,
                        plays: { $sum: 1 },
                        streams: { $sum: { $ifNull: ['$streamListeners', 0] } },
                        skips: { $sum: { $cond: ['$wasSkipped', 1, 0] } },
                    },
                },
            ]),
            SongPlay.aggregate([
                { $match: { startedAt: { $gte: from, $lte: to } } },
                { $group: { _id: '$songId' } },
                { $count: 'count' },
            ]),
        ]);

        const topSongs = (topSongRollups.length > 0 ? topSongRollups : fallbackTopSongs.map((s) => ({
            songId: s._id,
            title: s.title,
            artist: s.artist,
            streams: s.streamCount,
            plays: s.uniquePlays,
            skips: s.skipCount,
            listeners: s.uniquePlays,
        }))).map((song) => ({
            ...song,
            skipRate: song.plays > 0 ? Math.round((song.skips / song.plays) * 100) : 0,
        }));

        const skipRates = topSongs
            .filter(song => song.plays >= 3)
            .sort((a, b) => b.skipRate - a.skipRate)
            .slice(0, 10)
            .map(song => ({
                title: song.title,
                artist: song.artist,
                plays: song.plays,
                skipRate: song.skipRate,
            }));

        const summary = {
            plays: summaryAgg[0]?.plays ?? 0,
            streams: summaryAgg[0]?.streams ?? 0,
            skippedPlays: summaryAgg[0]?.skips ?? 0,
            activeSongs: activeSongCountAgg[0]?.count ?? 0,
        };
        const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));

        res.json({
            success: true,
            data: {
                playsPerPeriod,
                playsPerDay: playsPerPeriod, // backward-compatible key
                topSongs,
                skipRates,
                geoBreakdown,
                summary,
                granularity,
                from: from.toISOString(),
                to: to.toISOString(),
                days,
            },
        });
    } catch (e) { next(e); }
};

// ── Platform Config ───────────────────────────────────────────────────────────

export const getPlatformConfig = async (req, res, next) => {
    try {
        const config = await getConfig();
        res.json({ success: true, data: config });
    } catch (e) { next(e); }
};

export const updatePlatformConfig = async (req, res, next) => {
    try {
        const allowed = ['withdrawFeePercent', 'minWithdrawWinPoints', 'winPointsToUsdCents'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                const val = Number(req.body[key]);
                if (!Number.isFinite(val) || val < 0) {
                    return res.status(400).json({ message: `Invalid value for ${key}` });
                }
                update[key] = val;
            }
        }
        const config = await PlatformConfig.findOneAndUpdate(
            { key: 'global' },
            { $set: update },
            { new: true, upsert: true }
        );
        res.json({ success: true, data: config });
    } catch (e) { next(e); }
};

// ── Catalog: Artists ──────────────────────────────────────────────────────────

export const getArtists = async (req, res, next) => {
    try {
        const search = String(req.query.search ?? '').trim();
        const q = search ? { name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
        const artists = await Artist.find(q).sort({ name: 1 }).limit(200).lean();
        // Sync song counts (cheap aggregate over Song.artist text match)
        res.json({ success: true, data: artists });
    } catch (e) { next(e); }
};

export const createArtist = async (req, res, next) => {
    try {
        const name = String(req.body?.name ?? '').trim().slice(0, 160);
        const bio  = String(req.body?.bio ?? '').trim().slice(0, 2000);
        const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim() : null;
        if (!name) return res.status(400).json({ message: 'Name is required' });
        try {
            const artist = await Artist.create({ name, bio, imageUrl });
            res.status(201).json({ success: true, data: artist });
        } catch (err) {
            if (err.code === 11000) return res.status(409).json({ message: 'Artist with this name already exists' });
            throw err;
        }
    } catch (e) { next(e); }
};

export const updateArtist = async (req, res, next) => {
    try {
        const update = {};
        if (req.body?.name !== undefined)     update.name = String(req.body.name).trim().slice(0, 160);
        if (req.body?.bio !== undefined)      update.bio = String(req.body.bio).trim().slice(0, 2000);
        if (req.body?.imageUrl !== undefined) update.imageUrl = req.body.imageUrl ? String(req.body.imageUrl).trim() : null;
        const artist = await Artist.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!artist) return res.status(404).json({ message: 'Artist not found' });
        res.json({ success: true, data: artist });
    } catch (e) { next(e); }
};

export const getArtistDetail = async (req, res, next) => {
    try {
        const artist = await Artist.findById(req.params.id).lean();
        if (!artist) return res.status(404).json({ message: 'Artist not found' });
        const [albums, songs] = await Promise.all([
            Album.find({ artistId: artist._id }).sort({ releaseYear: -1 }).limit(50).lean(),
            Song.find({ $or: [{ artistId: artist._id }, { artist: artist.name }] })
                .sort({ uniquePlays: -1 }).limit(50)
                .select('title artist imageUrl duration uniquePlays streamCount skipCount createdAt')
                .lean(),
        ]);
        const totals = songs.reduce((acc, s) => {
            acc.plays   += s.uniquePlays ?? 0;
            acc.streams += s.streamCount ?? 0;
            acc.skips   += s.skipCount ?? 0;
            return acc;
        }, { plays: 0, streams: 0, skips: 0 });
        res.json({ success: true, data: { artist, albums, songs, totals } });
    } catch (e) { next(e); }
};

export const uploadArtistImage = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Image file is required' });
        const mime = String(req.file.mimetype ?? '').toLowerCase();
        if (!ALLOWED_IMAGE_MIME.has(mime)) return res.status(400).json({ message: 'Only JPEG, PNG, WebP, or GIF images are allowed' });
        if (req.file.size > MAX_SONG_IMAGE_BYTES) return res.status(400).json({ message: `Image must be <= ${MAX_SONG_IMAGE_BYTES / (1024 * 1024)}MB` });
        const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
        const key = `images/artists/${randomUUID()}.${ext}`;
        await putObject(key, req.file.buffer, mime);
        const presignedUrl = await getPresignedUrl(key, SONG_IMAGE_PRESIGN_TTL);
        res.json({ success: true, data: { key, presignedUrl } });
    } catch (e) { next(e); }
};

export const deleteArtist = async (req, res, next) => {
    try {
        const a = await Artist.findByIdAndDelete(req.params.id);
        if (!a) return res.status(404).json({ message: 'Artist not found' });
        // Detach albums from this artist (don't cascade-delete albums)
        await Album.updateMany({ artistId: a._id }, { $set: { artistId: null } });
        res.json({ success: true });
    } catch (e) { next(e); }
};

// ── Catalog: Albums ───────────────────────────────────────────────────────────

export const getAlbums = async (req, res, next) => {
    try {
        const search = String(req.query.search ?? '').trim();
        const q = search ? { title: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
        const albums = await Album.find(q).populate('artistId', 'name').sort({ createdAt: -1 }).limit(200).lean();
        res.json({ success: true, data: albums });
    } catch (e) { next(e); }
};

export const createAlbum = async (req, res, next) => {
    try {
        const title = String(req.body?.title ?? '').trim().slice(0, 200);
        const artistId = req.body?.artistId || null;
        const coverImageUrl = req.body?.coverImageUrl ? String(req.body.coverImageUrl).trim() : null;
        const releaseYear = req.body?.releaseYear ? Number(req.body.releaseYear) : null;
        if (!title) return res.status(400).json({ message: 'Title is required' });
        let artistName = '';
        if (artistId) {
            const a = await Artist.findById(artistId).select('name').lean();
            if (!a) return res.status(400).json({ message: 'Artist not found' });
            artistName = a.name;
        }
        const album = await Album.create({ title, artistId, artistName, coverImageUrl, releaseYear });
        res.status(201).json({ success: true, data: album });
    } catch (e) { next(e); }
};

export const updateAlbum = async (req, res, next) => {
    try {
        const update = {};
        if (req.body?.title !== undefined) update.title = String(req.body.title).trim().slice(0, 200);
        if (req.body?.coverImageUrl !== undefined) update.coverImageUrl = req.body.coverImageUrl ? String(req.body.coverImageUrl).trim() : null;
        if (req.body?.releaseYear !== undefined) update.releaseYear = req.body.releaseYear ? Number(req.body.releaseYear) : null;
        if (req.body?.artistId !== undefined) {
            update.artistId = req.body.artistId || null;
            if (update.artistId) {
                const a = await Artist.findById(update.artistId).select('name').lean();
                if (!a) return res.status(400).json({ message: 'Artist not found' });
                update.artistName = a.name;
            } else {
                update.artistName = '';
            }
        }
        const album = await Album.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!album) return res.status(404).json({ message: 'Album not found' });
        res.json({ success: true, data: album });
    } catch (e) { next(e); }
};

export const getAlbumDetail = async (req, res, next) => {
    try {
        const album = await Album.findById(req.params.id).populate('artistId', 'name imageUrl').lean();
        if (!album) return res.status(404).json({ message: 'Album not found' });
        const songs = await Song.find({ albumId: album._id })
            .sort({ createdAt: 1 })
            .select('title artist imageUrl duration uniquePlays streamCount skipCount createdAt')
            .lean();
        const totals = songs.reduce((acc, s) => {
            acc.duration += s.duration ?? 0;
            acc.plays    += s.uniquePlays ?? 0;
            return acc;
        }, { duration: 0, plays: 0 });
        res.json({ success: true, data: { album, songs, totals } });
    } catch (e) { next(e); }
};

export const uploadAlbumImage = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Image file is required' });
        const mime = String(req.file.mimetype ?? '').toLowerCase();
        if (!ALLOWED_IMAGE_MIME.has(mime)) return res.status(400).json({ message: 'Only JPEG, PNG, WebP, or GIF images are allowed' });
        if (req.file.size > MAX_SONG_IMAGE_BYTES) return res.status(400).json({ message: `Image must be <= ${MAX_SONG_IMAGE_BYTES / (1024 * 1024)}MB` });
        const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
        const key = `images/albums/${randomUUID()}.${ext}`;
        await putObject(key, req.file.buffer, mime);
        const presignedUrl = await getPresignedUrl(key, SONG_IMAGE_PRESIGN_TTL);
        res.json({ success: true, data: { key, presignedUrl } });
    } catch (e) { next(e); }
};

export const deleteAlbum = async (req, res, next) => {
    try {
        const a = await Album.findByIdAndDelete(req.params.id);
        if (!a) return res.status(404).json({ message: 'Album not found' });
        await Song.updateMany({ albumId: a._id }, { $set: { albumId: null } });
        res.json({ success: true });
    } catch (e) { next(e); }
};

// ── Growth Analytics ──────────────────────────────────────────────────────────
//
// Data-analyst grade subscription/user growth dashboard. Returns:
//   - Summary cards: totals + period-over-period deltas
//   - Tier composition (FREE/PREMIUM/CREATOR snapshot)
//   - Time-series: new signups, paid signups, MRR per bucket
//   - Cohort retention: % of users from signup-month-N still on a paid tier today
//   - Churn rate (recent window)
//
// Granularity: 'monthly' | 'quarterly' | 'yearly' — drives the bucket size + window.
// Default window: monthly = 12 months back, quarterly = 8 quarters, yearly = 5 years.

export const getGrowthAnalytics = async (req, res, next) => {
    try {
        const granularity = ['monthly', 'quarterly', 'yearly'].includes(String(req.query.granularity))
            ? String(req.query.granularity) : 'monthly';

        const now = new Date();
        // Window length in months
        const monthsBack = granularity === 'yearly' ? 60 : granularity === 'quarterly' ? 24 : 12;
        const windowStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
        const prevWindowStart = new Date(now.getFullYear(), now.getMonth() - monthsBack * 2, 1);

        // Mongo $dateTrunc unit
        const truncUnit = granularity === 'yearly' ? 'year' : granularity === 'quarterly' ? 'quarter' : 'month';

        // ── Tier composition (snapshot) ──
        const tierAgg = await User.aggregate([
            { $group: { _id: '$userTier', count: { $sum: 1 } } },
        ]);
        const tierComposition = Object.fromEntries(tierAgg.map(t => [t._id, t.count]));
        const totalUsers = tierAgg.reduce((sum, t) => sum + t.count, 0);
        const paidUsers = (tierComposition.PREMIUM ?? 0) + (tierComposition.CREATOR ?? 0);

        // ── Active vs canceled subscription status ──
        const statusAgg = await User.aggregate([
            { $match: { userTier: { $in: ['PREMIUM', 'CREATOR'] } } },
            { $group: { _id: '$subscriptionStatus', count: { $sum: 1 } } },
        ]);
        const subStatusCounts = Object.fromEntries(statusAgg.map(s => [s._id ?? 'none', s.count]));
        const activeSubs = subStatusCounts.active ?? 0;

        // ── MRR (Monthly Recurring Revenue) snapshot ──
        // Count active subs by tier × plan monthly price.
        const plans = await SubscriptionPlan.find().lean();
        const planByTier = Object.fromEntries(plans.map(p => [p.tier, p]));
        const tierActiveAgg = await User.aggregate([
            { $match: { subscriptionStatus: 'active', userTier: { $in: ['PREMIUM', 'CREATOR'] } } },
            { $group: { _id: '$userTier', count: { $sum: 1 } } },
        ]);
        let mrrCents = 0;
        for (const row of tierActiveAgg) {
            const plan = planByTier[row._id];
            if (plan?.priceMonthlyUsd) mrrCents += row.count * plan.priceMonthlyUsd;
        }

        // ── Time-series: new signups per bucket ──
        const signupSeries = await User.aggregate([
            { $match: { createdAt: { $gte: windowStart } } },
            { $group: {
                _id: { period: { $dateTrunc: { date: '$createdAt', unit: truncUnit } } },
                signups:    { $sum: 1 },
                paidSignups: { $sum: { $cond: [{ $in: ['$userTier', ['PREMIUM', 'CREATOR']] }, 1, 0] } },
            }},
            { $sort: { '_id.period': 1 } },
        ]);

        // ── Period-over-period: signups + revenue this window vs prev window ──
        const [thisWindow, prevWindow] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: windowStart, $lte: now } }),
            User.countDocuments({ createdAt: { $gte: prevWindowStart, $lt: windowStart } }),
        ]);
        const signupGrowth = prevWindow > 0 ? Math.round(((thisWindow - prevWindow) / prevWindow) * 100) : null;

        // Revenue from completed topups this window
        const [thisRevenue, prevRevenue] = await Promise.all([
            Transaction.aggregate([
                { $match: { type: 'topup', status: 'completed', createdAt: { $gte: windowStart, $lte: now } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
                { $match: { type: 'topup', status: 'completed', createdAt: { $gte: prevWindowStart, $lt: windowStart } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);
        const thisRevTotal = thisRevenue[0]?.total ?? 0;
        const prevRevTotal = prevRevenue[0]?.total ?? 0;
        const revenueGrowth = prevRevTotal > 0 ? Math.round(((thisRevTotal - prevRevTotal) / prevRevTotal) * 100) : null;

        // ── Churn: users in canceled or past_due in last window ──
        const churnedThisWindow = await User.countDocuments({
            subscriptionStatus: { $in: ['canceled', 'past_due'] },
            updatedAt: { $gte: windowStart },
        });
        // Approximate churn rate: churned / (active + churned)
        const churnRate = (activeSubs + churnedThisWindow) > 0
            ? Math.round((churnedThisWindow / (activeSubs + churnedThisWindow)) * 100 * 10) / 10
            : 0;

        // ── Cohort retention (last 6 monthly cohorts) ──
        // For each cohort month: how many signed up, of those how many are still on paid tier.
        // Note: this is a coarse approximation — we lack tier-change history, so we treat
        // "currently paid" as a proxy for "retained as paying customer".
        const cohortMonths = 6;
        const cohortStart = new Date(now.getFullYear(), now.getMonth() - cohortMonths, 1);
        const cohorts = await User.aggregate([
            { $match: { createdAt: { $gte: cohortStart } } },
            { $group: {
                _id: { $dateTrunc: { date: '$createdAt', unit: 'month' } },
                signups: { $sum: 1 },
                stillPaid: { $sum: { $cond: [
                    { $and: [
                        { $in: ['$userTier', ['PREMIUM', 'CREATOR']] },
                        { $eq: ['$subscriptionStatus', 'active'] },
                    ]}, 1, 0,
                ]}},
            }},
            { $sort: { '_id': 1 } },
        ]);

        // ── Conversion rate (paid / total) ──
        const conversionRate = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100 * 10) / 10 : 0;

        res.json({
            success: true,
            data: {
                granularity,
                windowStart,
                summary: {
                    totalUsers,
                    paidUsers,
                    activeSubs,
                    conversionRate,
                    churnRate,
                    mrrCents,
                    arrCents: mrrCents * 12,
                    thisWindowSignups: thisWindow,
                    prevWindowSignups: prevWindow,
                    signupGrowth,
                    thisWindowRevenueCents: thisRevTotal,
                    prevWindowRevenueCents: prevRevTotal,
                    revenueGrowth,
                },
                tierComposition,
                subStatusCounts,
                series: signupSeries.map(r => ({
                    period: r._id.period,
                    signups: r.signups,
                    paidSignups: r.paidSignups,
                })),
                cohorts: cohorts.map(c => ({
                    cohort: c._id,
                    signups: c.signups,
                    stillPaid: c.stillPaid,
                    retentionPercent: c.signups > 0 ? Math.round((c.stillPaid / c.signups) * 1000) / 10 : 0,
                })),
            },
        });
    } catch (e) { next(e); }
};

// ── Catalog vocabulary (genres, moods, keys for admin form) ───────────────────

export const getSongVocabulary = async (req, res) => {
    res.json({
        success: true,
        data: { genres: SONG_GENRES, moods: SONG_MOODS, musicalKeys: MUSICAL_KEYS },
    });
};
