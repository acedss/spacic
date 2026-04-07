import mongoose from "mongoose";

// Algorithm to extract duration from audio file can be implemented during upload process

const songSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, required: true },
    imageUrl: { type: String, required: true },
    s3Key: { type: String, required: true },
    duration:    { type: Number, required: true },
    albumId:     { type: mongoose.Schema.ObjectId, ref: 'Album' },

    // Streaming analytics — denormalized counters, incremented by recordSongTransition
    streamCount: { type: Number, default: 0 },  // sum of streamListeners across all plays
    uniquePlays: { type: Number, default: 0 },  // times song was played in any room
    skipCount:   { type: Number, default: 0 },  // times skipped before 30s
}, { timestamps: true });

export const Song = mongoose.model("Song", songSchema);