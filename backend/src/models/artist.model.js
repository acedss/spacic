import mongoose from 'mongoose';

const artistSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true, maxlength: 160 },
    bio:      { type: String, default: '', maxlength: 2000 },
    imageUrl: { type: String, default: null },
    songCount: { type: Number, default: 0 },
}, { timestamps: true });

artistSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Artist = mongoose.model('Artist', artistSchema);
