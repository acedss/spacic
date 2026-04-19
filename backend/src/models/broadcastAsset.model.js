import mongoose from 'mongoose';

// BroadcastAsset — pre-recorded or uploaded audio clips a creator can play to their room.
// Two creation flows:
//   'recording' → MediaRecorder in-browser → upload blob to S3 → confirm
//   'file'      → file picker → upload to S3 → confirm
// Both go through the same presigned-PUT flow; only the client source differs.

const broadcastAssetSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    type: {
        type: String,
        enum: ['recording', 'file'],
        required: true,
    },
    label: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    s3Key: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        default: 'audio/webm',
    },
    durationSeconds: {
        type: Number,
        default: null,
    },
    sizeBytes: {
        type: Number,
        default: null,
    },
    // 'pending' = presigned URL issued but upload not yet confirmed
    // 'ready'   = confirmed, available for playback
    status: {
        type: String,
        enum: ['pending', 'ready'],
        default: 'pending',
    },
}, { timestamps: true });

// A creator will rarely have more than ~50 assets; no need for compound indexes
broadcastAssetSchema.index({ creatorId: 1, status: 1 });

export const BroadcastAsset = mongoose.model('BroadcastAsset', broadcastAssetSchema);
