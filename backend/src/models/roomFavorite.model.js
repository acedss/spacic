import mongoose from 'mongoose';

const roomFavoriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
}, { timestamps: true });

// One favorite per user per room
roomFavoriteSchema.index({ userId: 1, roomId: 1 }, { unique: true });
// Fast lookup: all rooms a user has favorited
roomFavoriteSchema.index({ userId: 1 });
// Fast lookup: all users who favorited a room
roomFavoriteSchema.index({ roomId: 1 });

export const RoomFavorite = mongoose.model('RoomFavorite', roomFavoriteSchema);
