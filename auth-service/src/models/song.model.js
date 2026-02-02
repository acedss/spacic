import mongoose from "mongoose";

const songSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, required: true },
    s3Key: { type: String, required: true },
    duration: { type: Number, required: true }, // For controlling playback length, in seconds
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },
    thumbnailUrl: { type: String }
}, { timestamps: true });

export const Song = mongoose.model("Song", songSchema);