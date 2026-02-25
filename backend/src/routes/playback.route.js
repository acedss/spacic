// Routes: Wire endpoints to controllers (safety net fallback)
// Socket.IO is primary for real-time sync
// REST endpoints are fallback when WebSocket drops
//
// GET /api/playback - get current state
// POST /api/playback/play - play a song
// POST /api/playback/pause - pause playback
// POST /api/playback/resume - resume playback
// POST /api/playback/update-time - update playback time

import Router from 'express';
import * as controller from '../controllers/playback.controller.js';

const router = Router();

router.get('/', controller.getPlaybackState);
router.post('/play', controller.playSong);
router.post('/pause', controller.pausePlayback);
router.post('/resume', controller.resumePlayback);
router.post('/update-time', controller.updatePlaybackTime);

export default router;
