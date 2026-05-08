// In Docker: RECSYS_URL=http://spacic-recsys:8000 (container name on web_gateway network)
// In dev:    RECSYS_URL=http://localhost:8000
import { Room } from '../models/room.model.js';
import { User } from '../models/user.model.js';

const RECSYS_URL = process.env.RECSYS_URL ?? 'http://localhost:8000';
const INTERNAL_KEY = process.env.RECSYS_INTERNAL_API_KEY ?? 'spacic-recsys-internal-2026';

const internalHeaders = {
    'Content-Type': 'application/json',
    'x-internal-key': INTERNAL_KEY,
};

const ROOM_SELECT = 'title description status coverImageUrl tags favoriteCount stats.totalListeners creatorId';

// When RecSys is offline or has no training data, surface popular live rooms so
// /discover never looks empty. Sorted by listenerCount then favoriteCount —
// matches what a "trending" feed would compute organically.
const popularRoomsFallback = async (limit) => {
    const docs = await Room.find({ status: 'live' })
        .sort({ 'stats.totalListeners': -1, favoriteCount: -1, createdAt: -1 })
        .limit(limit)
        .select(ROOM_SELECT)
        .populate('creatorId', 'fullName imageUrl')
        .lean();
    return docs;
};

// Fetch raw roomIds from RecSys and enrich with Room documents.
// Re-sorts to preserve the RecSys ranking order.
const fetchAndEnrich = async (mongoUserId, limit) => {
    const response = await fetch(`${RECSYS_URL}/recs/${mongoUserId}?limit=${limit}`, {
        headers: internalHeaders,
        signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Object.assign(new Error('RecSys service error'), { statusCode: 502 });

    const data = await response.json();
    const { roomIds = [], source, generatedAt } = data;

    if (!roomIds.length) {
        const rooms = await popularRoomsFallback(limit);
        return { rooms, source: 'fallback', generatedAt };
    }

    const docs = await Room.find({ _id: { $in: roomIds } })
        .select(ROOM_SELECT)
        .populate('creatorId', 'fullName imageUrl')
        .lean();

    const byId = Object.fromEntries(docs.map(d => [d._id.toString(), d]));
    const rooms = roomIds.map(id => byId[id]).filter(Boolean);

    return { rooms, source: source ?? 'cache', generatedAt };
};

export const getRecSysStatus = async (req, res, next) => {
    try {
        const response = await fetch(`${RECSYS_URL}/admin/status`, {
            headers: internalHeaders,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return res.status(502).json({ message: 'RecSys service returned an error' });
        const data = await response.json();
        res.json({ data });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'RecSys service is offline', offline: true });
        }
        next(err);
    }
};

export const triggerTraining = async (req, res, next) => {
    try {
        const response = await fetch(`${RECSYS_URL}/admin/train`, {
            method: 'POST',
            headers: internalHeaders,
            body: JSON.stringify({ force: req.body?.force ?? false }),
            signal: AbortSignal.timeout(5000),
        });
        if (response.status === 409) return res.status(409).json({ message: 'Training already in progress' });
        if (!response.ok) return res.status(502).json({ message: 'RecSys service returned an error' });
        const data = await response.json();
        res.json({ data });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'RecSys service is offline', offline: true });
        }
        next(err);
    }
};

// GET /api/recs/me — personalized room recommendations for the authenticated user.
// Resolves clerkId → MongoDB _id, calls RecSys, enriches roomIds with Room docs.
export const getMyRecs = async (req, res, next) => {
    try {
        const clerkId = req.devBypass ? req.devClerkId : req.auth().userId;
        const limit   = Math.min(parseInt(req.query.limit) || 20, 50);

        const user = await User.findOne({ clerkId }).select('_id').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const result = await fetchAndEnrich(user._id.toString(), limit);
        res.json({ success: true, data: result });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            const rooms = await popularRoomsFallback(Math.min(parseInt(req.query.limit) || 20, 50));
            return res.json({ success: true, data: { rooms, source: 'offline', generatedAt: null } });
        }
        next(err);
    }
};

// GET /api/recs/:userId — admin/internal use only (by raw MongoDB user ID)
export const getUserRecs = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const result = await fetchAndEnrich(userId, limit);
        res.json({ success: true, data: result });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            const rooms = await popularRoomsFallback(Math.min(parseInt(req.query.limit) || 20, 50));
            return res.json({ success: true, data: { rooms, source: 'offline', generatedAt: null } });
        }
        next(err);
    }
};
