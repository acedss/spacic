import { Router } from 'express';
import { requireAdmin, protectRoute } from '../middlewares/auth.middleware.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();
router.use(protectRoute, requireAdmin);

router.get('/check', admin.checkAdmin);

// Plans
router.get('/plans',            admin.getPlans);
router.patch('/plans/:slug',    admin.updatePlan);

// TopupPackages
router.get('/topup-packages',                          admin.getTopupPackages);
router.post('/topup-packages',                         admin.createTopupPackage);
router.patch('/topup-packages/:packageId',             admin.updateTopupPackage);
router.delete('/topup-packages/:packageId',            admin.deleteTopupPackage);

// Users
router.get('/users',                                   admin.getUsers);
router.patch('/users/:clerkId/tier',                   admin.updateUserTier);
router.patch('/users/:clerkId/subscription',           admin.updateUserSubscription);

// Songs
router.get('/songs',                admin.getSongs);
router.post('/songs/upload-url',    admin.getSongUploadUrl);
router.post('/songs',               admin.createSong);
router.delete('/songs/:id',         admin.deleteSong);

// Stats & Analytics
router.get('/stats',            admin.getStats);
router.get('/analytics',        admin.getAnalytics);
router.get('/analytics/songs',  admin.getSongAnalytics);

export default router;
