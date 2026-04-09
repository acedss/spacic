import mongoose from "mongoose";

const listenerSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
    leftAt: {
        type: Date,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },

    // Geo — resolved from IP at room-join time via geoip-lite
    country: { type: String, default: null },  // 'VN', 'US', 'JP' ...
    region:  { type: String, default: null },  // state / province
    city:    { type: String, default: null },
});

// Prevent duplicate active listeners for same user+room
listenerSchema.index(
    { roomId: 1, userId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);
listenerSchema.index({ roomId: 1, isActive: 1 });
listenerSchema.index({ userId: 1 });

export const Listener = mongoose.model("Listener", listenerSchema);
