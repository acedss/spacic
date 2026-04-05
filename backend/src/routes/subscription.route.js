import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

// Public — plans shown on pricing page before login
router.get('/plans', subscriptionController.getPlans);

// Auth required to start a subscription checkout
router.post('/subscribe', protectRoute, subscriptionController.subscribe);

export default router;
