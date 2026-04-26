import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { getMyRecs, getUserRecs } from '../controllers/recsys.controller.js';

const router = Router();

// Personalized recommendations for the logged-in user
router.get('/me', protectRoute, getMyRecs);

// Raw lookup by MongoDB userId (admin/internal)
router.get('/:userId', protectRoute, getUserRecs);

export default router;
