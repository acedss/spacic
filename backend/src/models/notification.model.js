import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipientClerkId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['friend_request', 'friend_accepted', 'room_invite', 'room_live', 'system', 'admin_gift'],
        required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ recipientClerkId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
