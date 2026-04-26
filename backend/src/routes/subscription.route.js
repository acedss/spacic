import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { idempotency } from '../middlewares/idempotency.js';
import { subscribeSchema } from '../lib/schemas.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

// Public — plans shown on pricing page before login
router.get('/plans', subscriptionController.getPlans);

// Auth required
router.use(protectRoute);

router.get('/status',      subscriptionController.getSubscriptionStatus);
router.post('/subscribe',  idempotency(), validate(subscribeSchema), subscriptionController.subscribe);
router.delete('/cancel',   subscriptionController.cancelSubscription);
router.post('/reactivate', subscriptionController.reactivateSubscription);

export default router;
