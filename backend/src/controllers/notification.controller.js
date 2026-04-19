import { Notification } from '../models/notification.model.js';

export const getNotifications = async (req, res, next) => {
    try {
        const clerkId = req.auth().userId;
        const notifications = await Notification.find({ recipientClerkId: clerkId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ data: notifications });
    } catch (error) {
        next(error);
    }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const clerkId = req.auth().userId;
        const count = await Notification.countDocuments({ recipientClerkId: clerkId, read: false });
        res.json({ count });
    } catch (error) {
        next(error);
    }
};

export const markRead = async (req, res, next) => {
    try {
        const clerkId = req.auth().userId;
        const { ids } = req.body ?? {};
        if (ids && Array.isArray(ids)) {
            await Notification.updateMany(
                { _id: { $in: ids }, recipientClerkId: clerkId },
                { $set: { read: true } }
            );
        } else {
            await Notification.updateMany(
                { recipientClerkId: clerkId, read: false },
                { $set: { read: true } }
            );
        }
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const createNotification = async (recipientClerkId, type, title, message, metadata = {}) => {
    return Notification.create({ recipientClerkId, type, title, message, metadata });
};
