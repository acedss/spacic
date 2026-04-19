import { BroadcastAsset } from '../models/broadcastAsset.model.js';
import { Room } from '../models/room.model.js';
import { User } from '../models/user.model.js';
import { getPutPresignedUrl, getPresignedUrl, deleteS3Object } from '../services/s3.services.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

// ── List creator's broadcast assets ──────────────────────────────────────────

export const listAssets = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const user = await User.findOne({ clerkId }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const assets = await BroadcastAsset
            .find({ creatorId: user._id, status: 'ready' })
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, data: assets });
    } catch (err) {
        next(err);
    }
};

// ── Request a presigned PUT URL for a new asset ───────────────────────────────
// Body: { label, type: 'recording'|'file', mimeType, filename? }
// Returns: { uploadUrl, assetId, s3Key }

export const requestUploadUrl = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const user = await User.findOne({ clerkId }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const room = await Room.findOne({ creatorId: user._id }).select('_id');
        if (!room) return res.status(404).json({ message: 'Room not found — create a channel first' });

        const { label, type = 'file', mimeType = 'audio/webm' } = req.body;
        if (!label?.trim()) return res.status(400).json({ message: 'Label required' });
        if (!['recording', 'file'].includes(type)) return res.status(400).json({ message: 'Invalid type' });

        const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
        const s3Key = `broadcasts/${user._id}/${crypto.randomUUID()}.${ext}`;

        const asset = await BroadcastAsset.create({
            creatorId: user._id,
            roomId: room._id,
            type,
            label: label.trim(),
            s3Key,
            mimeType,
            status: 'pending',
        });

        const uploadUrl = await getPutPresignedUrl(s3Key, mimeType);

        res.status(201).json({ success: true, data: { uploadUrl, assetId: asset._id, s3Key } });
    } catch (err) {
        next(err);
    }
};

// ── Confirm upload complete — mark asset 'ready' ─────────────────────────────
// Body: { durationSeconds?, sizeBytes? }

export const confirmAsset = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const user = await User.findOne({ clerkId }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const asset = await BroadcastAsset.findOne({
            _id: req.params.assetId,
            creatorId: user._id,
            status: 'pending',
        });
        if (!asset) return res.status(404).json({ message: 'Asset not found or already confirmed' });

        const { durationSeconds, sizeBytes } = req.body;
        asset.status = 'ready';
        if (durationSeconds != null) asset.durationSeconds = Number(durationSeconds);
        if (sizeBytes != null) asset.sizeBytes = Number(sizeBytes);
        await asset.save();

        res.json({ success: true, data: asset });
    } catch (err) {
        next(err);
    }
};

// ── Delete an asset ───────────────────────────────────────────────────────────

export const deleteAsset = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const user = await User.findOne({ clerkId }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const asset = await BroadcastAsset.findOne({ _id: req.params.assetId, creatorId: user._id });
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        // Best-effort S3 delete — don't fail request if S3 errors
        deleteS3Object(asset.s3Key).catch(err => console.warn('[BroadcastAsset] S3 delete failed:', err.message));

        await asset.deleteOne();
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// ── Get presigned GET URL for playback (used by socket handler) ───────────────

export const getPlaybackUrl = async (s3Key) => {
    // 1-hour expiry — long enough for a song transition, short enough to limit exposure
    return getPresignedUrl(s3Key, 3600);
};
