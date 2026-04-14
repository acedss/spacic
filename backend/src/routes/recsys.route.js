import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { getUserRecs } from '../controllers/recsys.controller.js';

const router = Router();

// GET /api/recs/:userId — personalized song recommendations
// Protected: user must be authenticated (can only fetch own recs)
router.get('/:userId', protectRoute, getUserRecs);

export default router;
