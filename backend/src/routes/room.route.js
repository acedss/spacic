import { Router } from "express";
import multer from "multer";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
    getPublicRoomsSchema,
    addToQueueSchema,
    sendChatMessageSchema,
    trackReferralSchema,
    updateFeatureFlagsSchema,
} from "../lib/schemas.js";
import * as roomController from "../controllers/room.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// Discovery (public, no auth required)
router.get("/public",    validate(getPublicRoomsSchema), roomController.getPublicRooms);
router.get("/tag-counts", roomController.getTagCounts);

// Static paths — must be before /:roomId so they aren't swallowed as params
router.get("/me/room",          protectRoute, roomController.getMyRoom);
router.get("/me/creator-stats", protectRoute, roomController.getCreatorStats);
router.get("/me/creator-analytics", protectRoute, roomController.getCreatorRoomAnalytics);
router.get("/me/favorites",     protectRoute, roomController.getFavoriteRooms);

// Room by ID (works for both offline and live)
router.get("/:roomId", roomController.getRoomById);

// Creator channel management
router.post("/",                        protectRoute, roomController.upsertRoom);
router.post("/cover-image",             protectRoute, upload.single('image'), roomController.uploadCoverImage);
router.post("/:roomId/go-live",         protectRoute, roomController.goLive);
router.post("/:roomId/go-offline",      protectRoute, roomController.goOffline);
router.patch("/me/feature-flags",       protectRoute, validate(updateFeatureFlagsSchema), roomController.updateFeatureFlags);

// Session actions (auth required)
router.post("/:roomId/join",  protectRoute, roomController.joinRoom);
router.post("/:roomId/leave", protectRoute, roomController.leaveRoom);
router.post("/:roomId/skip",  protectRoute, roomController.skipSong);
router.post("/:roomId/queue",  protectRoute, validate(addToQueueSchema), roomController.addToQueue);
router.patch("/:roomId/queue", protectRoute, roomController.updateQueueWhileLive);

// Chat
router.post("/:roomId/chat", protectRoute, validate(sendChatMessageSchema), roomController.sendChatMessage);

// Favorites
router.get("/:roomId/favorite",  protectRoute, roomController.getFavoriteStatus);
router.post("/:roomId/favorite", protectRoute, roomController.toggleFavorite);

// Referral analytics — called client-side when joining via shared link (?ref=userId)
router.post("/:roomId/referral", protectRoute, validate(trackReferralSchema), roomController.trackReferral);

export default router;
