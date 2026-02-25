import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    capacity: {
        type: Number,
        required: true,
    },
    isSaved: {
        type: Boolean,
        default: false,
    },
    playlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
    }],
    streamGoal: {
        type: Number,
        default: 0,
    },
    streamGoalCurrent: {
        type: Number,
        default: 0,
    },
    statsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RoomStats",
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

export const Room = mongoose.model("Room", roomSchema);
