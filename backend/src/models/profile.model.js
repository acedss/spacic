import mongoose from 'mongoose';

const ProfileSchema = new mongoose.Schema({
    clerkId: { type: String, required: true, unique: true },
    bio: String,
    location: String,
    website: String,
    createdAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);