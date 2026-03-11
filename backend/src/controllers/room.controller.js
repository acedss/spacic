// Controller: Room - thin handlers, delegates to room.service
// Max 50 lines per function; extract request data and call service only.

import * as roomService from "../services/room.service.js";

// Resolves clerkId from Clerk auth OR dev bypass header
const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const createRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const room = await roomService.createRoom(clerkId, req.body);
        res.status(201).json({ success: true, data: room });
    } catch (error) {
        next(error);
    }
};

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

export const closeRoom = async (req, res, next) => {
    try {
        const clerkId = getClerkId(req);
        const result = await roomService.closeRoom(req.params.roomId, clerkId);
        res.json({ success: true, data: result });
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
