import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    coverArt: { type: String, default: null }, // optional image URL
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
    }],
    isPublic: { type: Boolean, default: false },
}, { timestamps: true });

playlistSchema.index({ ownerId: 1, createdAt: -1 });

export const Playlist = mongoose.model("Playlist", playlistSchema);
