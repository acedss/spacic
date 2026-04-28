import { Router } from 'express';
import multer from 'multer';
import { requireAdmin, protectRoute } from '../middlewares/auth.middleware.js';
import * as admin from '../controllers/admin.controller.js';
import * as recsys from '../controllers/recsys.controller.js';
import * as alerts from '../controllers/adminAlert.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

router.get('/check', protectRoute, admin.checkAdmin);

// Grafana webhook — uses shared-secret token, NOT Clerk auth, so it must
// be registered before the requireAdmin middleware kicks in below.
router.post('/alerts/grafana-webhook', alerts.verifyGrafanaToken, alerts.ingestGrafanaWebhook);

router.use(protectRoute, requireAdmin);

// Admin alerts list/ack (Clerk-protected)
router.get('/alerts',           alerts.listAlerts);
router.patch('/alerts/:id/ack', alerts.acknowledgeAlert);

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
router.post('/users/:clerkId/gift-coins',              admin.giftCoins);
router.get('/users/:clerkId/transactions',             admin.getUserTransactions);

// Songs
router.get('/songs/vocabulary',         admin.getSongVocabulary);
router.get('/songs',                    admin.getSongs);
router.get('/songs/:id',                admin.getSongDetail);
router.post('/songs/upload',            upload.single('audio'), admin.uploadSongFile);
router.post('/songs/image-upload',      upload.single('image'), admin.uploadSongImage);
router.post('/songs/bulk-delete',       admin.bulkDeleteSongs);
router.post('/songs',                   admin.createSong);
router.patch('/songs/:id',              admin.updateSong);
router.delete('/songs/:id',             admin.deleteSong);

// Catalog: Artists
router.get('/artists',                   admin.getArtists);
router.get('/artists/:id',               admin.getArtistDetail);
router.post('/artists/image-upload',     upload.single('image'), admin.uploadArtistImage);
router.post('/artists',                  admin.createArtist);
router.patch('/artists/:id',             admin.updateArtist);
router.delete('/artists/:id',            admin.deleteArtist);

// Catalog: Albums
router.get('/albums',                    admin.getAlbums);
router.get('/albums/:id',                admin.getAlbumDetail);
router.post('/albums/image-upload',      upload.single('image'), admin.uploadAlbumImage);
router.post('/albums',                   admin.createAlbum);
router.patch('/albums/:id',              admin.updateAlbum);
router.delete('/albums/:id',             admin.deleteAlbum);

// Stats & Analytics
router.get('/stats',            admin.getStats);
router.get('/analytics',        admin.getAnalytics);
router.get('/analytics/songs',  admin.getSongAnalytics);
router.get('/analytics/growth', admin.getGrowthAnalytics);

// Platform config (fee %, withdrawal limits, exchange rate)
router.get('/config',           admin.getPlatformConfig);
router.patch('/config',         admin.updatePlatformConfig);

// RecSys monitoring
router.get('/recsys/status',    recsys.getRecSysStatus);
router.post('/recsys/train',    recsys.triggerTraining);

export default router;
