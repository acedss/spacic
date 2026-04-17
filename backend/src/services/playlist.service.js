import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";

const resolveUser = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select('_id');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
};

export const getMyPlaylists = async (clerkId) => {
    const user = await resolveUser(clerkId);
    return Playlist.find({ ownerId: user._id })
        .populate('songs', 'title artist imageUrl duration')
        .sort({ createdAt: -1 });
};

export const createPlaylist = async (clerkId, { name, songs = [], coverArt }) => {
    const user = await resolveUser(clerkId);
    const playlist = await Playlist.create({
        ownerId:  user._id,
        name:     name.trim(),
        songs,
        coverArt: coverArt ?? null,
    });
    return playlist.populate('songs', 'title artist imageUrl duration');
};

export const updatePlaylist = async (clerkId, playlistId, { name, songs, coverArt }) => {
    const user = await resolveUser(clerkId);
    const playlist = await Playlist.findOne({ _id: playlistId, ownerId: user._id });
    if (!playlist) throw Object.assign(new Error('Playlist not found'), { statusCode: 404 });

    if (name     !== undefined) playlist.name     = name.trim();
    if (songs    !== undefined) playlist.songs    = songs;
    if (coverArt !== undefined) playlist.coverArt = coverArt;

    await playlist.save();
    return playlist.populate('songs', 'title artist imageUrl duration');
};

export const deletePlaylist = async (clerkId, playlistId) => {
    const user = await resolveUser(clerkId);
    const result = await Playlist.deleteOne({ _id: playlistId, ownerId: user._id });
    if (result.deletedCount === 0) throw Object.assign(new Error('Playlist not found'), { statusCode: 404 });
};
