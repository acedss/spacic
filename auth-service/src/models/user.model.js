import mongoose from 'mongodb';

const UserSchema = new mongoose.Schema({
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    avatar: String,
    createdAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);