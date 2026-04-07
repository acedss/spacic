import { Router } from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import * as friend from '../controllers/friend.controller.js';

const router = Router();

router.use(protectRoute);

// SPC-57: Discovery & Search
router.get('/search',              friend.searchUsers);

// SPC-18: Activity feed
router.get('/activity',            friend.getFriendsActivity);

// SPC-55: Friend list + requests
router.get('/',                    friend.getFriends);
router.get('/requests',            friend.getIncomingRequests);
router.get('/sent',                friend.getSentRequests);
router.post('/request/:targetUserId', friend.sendRequest);
router.post('/accept/:friendshipId',  friend.acceptRequest);
router.post('/decline/:friendshipId', friend.declineRequest);
router.delete('/:friendshipId',    friend.unfriend);

// SPC-56: Direct invite
router.post('/invite',             friend.sendInvite);

export default router;
