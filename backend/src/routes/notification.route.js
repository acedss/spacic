import { Router } from 'express';
import { getNotifications, getUnreadCount, markRead } from '../controllers/notification.controller.js';
import { protectRoute } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/',       protectRoute, getNotifications);
router.get('/unread', protectRoute, getUnreadCount);
router.post('/read',  protectRoute, markRead);

export default router;
