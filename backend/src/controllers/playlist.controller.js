import * as playlistService from '../services/playlist.service.js';

export const getMyPlaylists = async (req, res, next) => {
    try {
        const playlists = await playlistService.getMyPlaylists(req.auth.userId);
        res.json({ data: playlists });
    } catch (err) { next(err); }
};

export const createPlaylist = async (req, res, next) => {
    try {
        const { name, songs, coverArt } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
        const playlist = await playlistService.createPlaylist(req.auth.userId, { name, songs, coverArt });
        res.status(201).json({ data: playlist });
    } catch (err) { next(err); }
};

export const updatePlaylist = async (req, res, next) => {
    try {
        const playlist = await playlistService.updatePlaylist(req.auth.userId, req.params.id, req.body);
        res.json({ data: playlist });
    } catch (err) { next(err); }
};

export const deletePlaylist = async (req, res, next) => {
    try {
        await playlistService.deletePlaylist(req.auth.userId, req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
};
