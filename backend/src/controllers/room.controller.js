// Controller: Room - thin handlers, delegates to room.service

import * as roomService from "../services/room.service.js";
import { Room } from '../models/room.model.js';
import { User } from '../models/user.model.js';
import { getIo } from '../lib/io.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

// ── Creator channel management ────────────────────────────────────────────

export const upsertRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const room = await roomService.upsertRoom(clerkId, req.body);
        res.status(200).json({ success: true, data: room });
    } catch (error) {
        next(error);
    }
};

export const getMyRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const room = await roomService.getMyRoom(clerkId);
        res.json({ success: true, data: room });
    } catch (error) {
        next(error);
    }
};

export const goLive = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const room = await roomService.goLive(req.params.roomId, clerkId);
        res.json({ success: true, data: room });
    } catch (error) {
        next(error);
    }
};

export const goOffline = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.goOffline(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// ── Discovery ─────────────────────────────────────────────────────────────

export const getPublicRooms = async (req, res, next) => {
    try {
        const { sort, limit, offset, search } = req.query;
        const result = await roomService.getPublicRooms({
            sort,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
            search,
        });
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

export const getRoomById = async (req, res, next) => {
    try {
        const room = await roomService.getRoomById(req.params.roomId);
        res.json({ success: true, data: room });
    } catch (error) {
        next(error);
    }
};

// ── Room session ──────────────────────────────────────────────────────────

export const joinRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.joinRoom(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const leaveRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        await roomService.leaveRoom(req.params.roomId, clerkId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const skipSong = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.skipSong(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const addToQueue = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const { songId } = req.body;
        const song = await roomService.addToQueue(req.params.roomId, clerkId, songId);
        res.status(201).json({ success: true, data: song });
    } catch (error) {
        next(error);
    }
};

export const sendChatMessage = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const { message } = req.body;
        const result = await roomService.sendChatMessage(req.params.roomId, clerkId, message);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const toggleFavorite = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.toggleFavorite(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const getFavoriteRooms = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.getFavoriteRooms(clerkId);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

export const getFavoriteStatus = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.getFavoriteStatus(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const getCreatorStats = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const stats = await roomService.getCreatorStats(clerkId);
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

export const getCreatorRoomAnalytics = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const analytics = await roomService.getCreatorRoomAnalytics(clerkId, req.query);
        res.json({ success: true, data: analytics });
    } catch (error) {
        next(error);
    }
};

export const updateQueueWhileLive = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.updateQueueWhileLive(clerkId, req.params.roomId, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// ── Feature flags ─────────────────────────────────────────────────────────────
// PATCH /rooms/me/feature-flags
// Body: Partial<{ liveMic, chat, donations, voting, minigames, voteQueue, broadcasts }>
// If room is live, broadcasts room:flags_updated to all listeners in real time.

export const updateFeatureFlags = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const user = await User.findOne({ clerkId }).select('_id');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const allowed = ['liveMic', 'chat', 'donations', 'voting', 'minigames', 'voteQueue', 'broadcasts'];
        const updates = {};
        for (const key of allowed) {
            if (typeof req.body[key] === 'boolean') {
                updates[`featureFlags.${key}`] = req.body[key];
            }
        }

        const room = await Room.findOneAndUpdate(
            { creatorId: user._id },
            { $set: updates },
            { new: true },
        );
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Notify live listeners immediately so they can update their UI
        if (room.status === 'live') {
            try {
                const io = getIo();
                io.to(room._id.toString()).emit('room:flags_updated', { featureFlags: room.featureFlags });
            } catch { /* io may not be ready in tests */ }
        }

        res.json({ success: true, data: room.featureFlags });
    } catch (err) {
        next(err);
    }
};

export const trackReferral = async (req, res, next) => {
    try {
        const clerkId        = getClerkId(req);
        const { ref, type }  = req.body;   // ref = referrer's clerkId, type = 'link' | 'activity_join'
        const { roomId }     = req.params;
        await roomService.trackReferralByClerkIds(clerkId, ref, roomId, type);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
