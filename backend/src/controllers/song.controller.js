import { Song } from "../models/song.model.js";
import { getPresignedUrl } from "../services/s3.services.js";

export const getAllSongs = async (req, res, next) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 }).lean();

        const songsWithUrls = await Promise.all(songs.map(async (song) => ({
            ...song,
            audioUrl: await getPresignedUrl(song.s3Key) // BE tự tạo URL tạm thời ở đây
        })));
        console.log("Fetched songs with URLs:", songsWithUrls);
        res.status(200).json(songsWithUrls);
    } catch (error) {
        next(error);
    }
};

export const getTestSong = async (req, res, next) => {
    try {
        const key = "songs/Edward Sharpe & The Magnetic Zeros - Home (Official Video).mp3";
        const url = await getPresignedUrl(key, 300);
        res.status(200).json({ audioUrl: url });
    } catch (error) {
        next(error);
    }
}