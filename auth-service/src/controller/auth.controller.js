export const authCallback = async (req, res, next) => {
    try {
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in auth callback:", error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
