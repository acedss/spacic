import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    clerkId: {
        type: String,
        required: true,
        unique: true,
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN", "CREATOR"],
        default: "USER",
    },
    userTier: {
        type: String,
        enum: ["FREE", "PREMIUM", "CREATOR"],
        default: "FREE",
    },
    balance: {
        type: Number,
        default: 0,
    }
}, { timestamps: true }
);

export const User = mongoose.model("User", userSchema);