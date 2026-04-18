import * as playlistService from '../services/playlist.service.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const getMyPlaylists = async (req, res, next) => {
    try {
        const playlists = await playlistService.getMyPlaylists(getClerkId(req));
        res.json({ data: playlists });
    } catch (err) { next(err); }
};

export const createPlaylist = async (req, res, next) => {
    try {
        const { name, songs, coverArt } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
        const playlist = await playlistService.createPlaylist(getClerkId(req), { name, songs, coverArt });
        res.status(201).json({ data: playlist });
    } catch (err) { next(err); }
};

export const updatePlaylist = async (req, res, next) => {
    try {
        const playlist = await playlistService.updatePlaylist(getClerkId(req), req.params.id, req.body);
        res.json({ data: playlist });
    } catch (err) { next(err); }
};

export const deletePlaylist = async (req, res, next) => {
    try {
        await playlistService.deletePlaylist(getClerkId(req), req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
};
