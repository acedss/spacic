import * as minigameService from '../services/minigame.service.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const getMinigamesForRoom = async (req, res, next) => {
    try {
        const games = await minigameService.getMinigamesForRoom(getClerkId(req), req.params.roomId);
        res.json({ data: games });
    } catch (err) { next(err); }
};

export const createMinigame = async (req, res, next) => {
    try {
        const game = await minigameService.createMinigame(getClerkId(req), req.params.roomId, req.body);
        res.status(201).json({ data: game });
    } catch (err) { next(err); }
};

export const updateMinigame = async (req, res, next) => {
    try {
        const game = await minigameService.updateMinigame(getClerkId(req), req.params.id, req.body);
        res.json({ data: game });
    } catch (err) { next(err); }
};

export const deleteMinigame = async (req, res, next) => {
    try {
        await minigameService.deleteMinigame(getClerkId(req), req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
};
