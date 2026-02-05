import { User } from "../models/user.model.js";

export const authCallback = async (req, res, next) => {
    try {

        const { clerkId, fullName, imageUrl, role } = req.body;
        console.log("Auth callback data received");

        const user = await User.findOne({ clerkId: clerkId });

        if (!user) {
            await User.create({
                clerkId: clerkId,
                fullName: fullName,
                imageUrl: imageUrl,
                role: role,
                balance: 0
            });
        }

        console.log("User created successfully");


        res.status(200).json({ success: true });

    } catch (error) {
        console.error("Error in auth callback:", error);
        next(error);
    }
};
