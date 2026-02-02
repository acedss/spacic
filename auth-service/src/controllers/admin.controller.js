
export const checkAdmin = async (req, res, next) => {
    res.status(200).json({ admin: true });
};