import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    avatar: String,
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);