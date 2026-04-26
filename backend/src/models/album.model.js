import mongoose from 'mongoose';

const albumSchema = new mongoose.Schema({
    title:        { type: String, required: true, trim: true, maxlength: 200 },
    artistId:     { type: mongoose.Schema.ObjectId, ref: 'Artist', default: null },
    artistName:   { type: String, default: '' }, // denormalized fallback
    coverImageUrl: { type: String, default: null },
    releaseYear:  { type: Number, default: null },
    songCount:    { type: Number, default: 0 },
}, { timestamps: true });

albumSchema.index({ title: 1, artistId: 1 });

export const Album = mongoose.model('Album', albumSchema);
