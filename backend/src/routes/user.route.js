import { Router } from 'express';
import { getPublicProfile } from '../controllers/user.controller.js';

const router = Router();

router.get('/:userId/public-profile', getPublicProfile);

export default router;
