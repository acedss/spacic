import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending',
    },
}, { timestamps: true });

// Prevent duplicate requests in the same direction (A→B)
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Fast lookup: all incoming requests for a user
friendshipSchema.index({ recipient: 1, status: 1 });

// Fast lookup: all outgoing requests from a user
friendshipSchema.index({ requester: 1, status: 1 });

export const Friendship = mongoose.model('Friendship', friendshipSchema);
