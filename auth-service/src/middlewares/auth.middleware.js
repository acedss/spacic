import { clerkClient } from 'clerk/express'

export const authCallback = async (req, res, next) => {
    try {
        const { id, firstName, lastName, imageUrl } = req.body;
        console.log('Received auth callback request:', { id, firstName, lastName, imageUrl });

        const user = await User.findOne({ clerkId: id });

        if (!user) {
            console.log('Creating new user...');
            await User.create({
                clerkId: id,
                fullName: `${firstName || ''} ${lastName || ''}`.trim(),
                imageUrl
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in auth callback:", error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};