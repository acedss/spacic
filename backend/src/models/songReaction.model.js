import mongoose from 'mongoose';

const songReactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    songId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
        required: true,
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    reaction: {
        type: String,
        enum: ['like', 'dislike'],
        required: true,
    },
}, { timestamps: true });

songReactionSchema.index({ userId: 1, songId: 1 }, { unique: true });
songReactionSchema.index({ songId: 1, reaction: 1 });
songReactionSchema.index({ userId: 1, reaction: 1 });

export const SongReaction = mongoose.model('SongReaction', songReactionSchema);
