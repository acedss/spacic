import { clerkClient } from "@clerk/express";
import { User } from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
    // Dev bypass: allows Postman/automated testing without a live Clerk JWT
    if (process.env.NODE_ENV !== "production") {
        const devToken = req.headers["x-dev-token"];
        if (devToken && devToken === process.env.DEV_BYPASS_TOKEN) {
            req.devBypass = true;
            req.devClerkId = process.env.DEV_CLERK_ID;
            return next();
        }
    }

    if (!req.auth().userId) {
        return res.status(401).json({ message: "Unauthorized - you must be logged in" });
    }
    next();
};

export const requireAdmin = async (req, res, next) => {
    try {
        const currentUser = await clerkClient.users.getUser(req.auth().userId);

        const userResponse = await User.findOne({ clerkId: currentUser.id });
        if (!userResponse) {
            return res.status(404).json({ message: "User not found" });
        }
        const isAdmin = userResponse.role === "ADMIN";

        if (!isAdmin) {
            return res.status(403).json({ message: "Unauthorized - you must be an admin" });
        }

        next();
    } catch (error) {
        next(error);
    }
};
