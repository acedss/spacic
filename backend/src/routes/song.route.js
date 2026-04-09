import Router from 'express';
import { getTestSong, getAllSongs, getTrending, getMyStats } from '../controllers/song.controller.js';
import { protectRoute } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/',                     getAllSongs);
router.get('/trending',             getTrending);
router.get('/me/stats',             protectRoute, getMyStats);
router.get('/test-get-presigned-url', getTestSong);

export default router;