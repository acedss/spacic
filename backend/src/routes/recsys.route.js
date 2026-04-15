import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { getUserRecs } from '../controllers/recsys.controller.js';

const router = Router();

router.get('/:userId', protectRoute, getUserRecs);

export default router;
