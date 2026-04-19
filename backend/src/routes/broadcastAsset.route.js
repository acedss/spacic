import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import * as ctrl from '../controllers/broadcastAsset.controller.js';

const router = Router();

// All routes are creator-only (auth required)
router.get('/',                          protectRoute, ctrl.listAssets);
router.post('/upload-url',               protectRoute, ctrl.requestUploadUrl);
router.patch('/:assetId/confirm',        protectRoute, ctrl.confirmAsset);
router.delete('/:assetId',              protectRoute, ctrl.deleteAsset);

export default router;
