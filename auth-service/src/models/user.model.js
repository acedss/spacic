import mongoose, { Mongoose } from "mongoose";

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
    balance: {
        type: Number,
        default: 0,
    }
}, { timestamps: true }
);

export const User = mongoose.model("User", userSchema);