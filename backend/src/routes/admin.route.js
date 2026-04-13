import { Router } from 'express';
import multer from 'multer';
import { requireAdmin, protectRoute } from '../middlewares/auth.middleware.js';
import * as admin from '../controllers/admin.controller.js';
import * as recsys from '../controllers/recsys.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

router.get('/check', protectRoute, admin.checkAdmin);
router.use(protectRoute, requireAdmin);

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
router.get('/songs',                    admin.getSongs);
router.post('/songs/upload-url',        admin.getSongUploadUrl); // Legacy endpoint
router.post('/songs/upload',            upload.single('audio'), admin.uploadSongFile); // New endpoint
router.post('/songs',                   admin.createSong);
router.delete('/songs/:id',             admin.deleteSong);

// Stats & Analytics
router.get('/stats',            admin.getStats);
router.get('/analytics',        admin.getAnalytics);
router.get('/analytics/songs',  admin.getSongAnalytics);

// RecSys monitoring
router.get('/recsys/status',    recsys.getRecSysStatus);
router.post('/recsys/train',    recsys.triggerTraining);

export default router;
