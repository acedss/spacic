import mongoose from 'mongoose';

// Room-level play record — one document per song transition.
// Owns the time window (startedAt / endedAt). ListenEvent references this.
const songPlaySchema = new mongoose.Schema({
    songId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Song',  required: true },
    roomId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Room',  required: true },
    startedAt:       { type: Date,    required: true },
    endedAt:         { type: Date,    required: true },
    totalDurationMs: { type: Number,  required: true },  // endedAt − startedAt
    wasSkipped:      { type: Boolean, default: false },

    // Listener counts computed at write time
    presentCount:    { type: Number, default: 0 },  // listeners present at any point
    streamListeners: { type: Number, default: 0 },  // heard >= 30 000 ms (Spotify rule)
    countedStream:   { type: Boolean, default: false },
}, { timestamps: false });

songPlaySchema.index({ songId: 1, startedAt: -1 });
songPlaySchema.index({ roomId: 1, startedAt: -1 });

export const SongPlay = mongoose.model('SongPlay', songPlaySchema);
