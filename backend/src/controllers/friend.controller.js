// Controller: Friends — thin handlers, delegates to friend.service
import * as friendService from '../services/friend.service.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const sendRequest       = async (req, res, next) => {
    try {
        const data = await friendService.sendRequest(getClerkId(req), req.params.targetUserId);
        res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
};

export const acceptRequest     = async (req, res, next) => {
    try {
        const data = await friendService.acceptRequest(getClerkId(req), req.params.friendshipId);
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const declineRequest    = async (req, res, next) => {
    try {
        const data = await friendService.declineRequest(getClerkId(req), req.params.friendshipId);
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const unfriend          = async (req, res, next) => {
    try {
        await friendService.unfriend(getClerkId(req), req.params.friendshipId);
        res.status(204).send();
    } catch (e) { next(e); }
};

export const getFriends        = async (req, res, next) => {
    try {
        const data = await friendService.getFriends(getClerkId(req));
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const getIncomingRequests = async (req, res, next) => {
    try {
        const data = await friendService.getIncomingRequests(getClerkId(req));
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const getSentRequests   = async (req, res, next) => {
    try {
        const data = await friendService.getSentRequests(getClerkId(req));
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const searchUsers       = async (req, res, next) => {
    try {
        const { q, limit, skip } = req.query;
        const data = await friendService.searchUsers(
            getClerkId(req), q,
            parseInt(limit) || 20,
            parseInt(skip)  || 0
        );
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const getFriendsActivity = async (req, res, next) => {
    try {
        const data = await friendService.getFriendsActivity(getClerkId(req));
        res.json({ success: true, data });
    } catch (e) { next(e); }
};

export const sendInvite        = async (req, res, next) => {
    try {
        const { friendId, roomId } = req.body;
        await friendService.sendInvite(getClerkId(req), friendId, roomId);
        res.status(204).send();
    } catch (e) { next(e); }
};

