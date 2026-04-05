import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as roomController from "../controllers/room.controller.js";

const router = Router();

// Discovery (public, no auth required)
router.get("/public", roomController.getPublicRooms);

// Static paths — must be before /:roomId so they aren't swallowed as params
router.get("/me/room",          protectRoute, roomController.getMyRoom);
router.get("/me/creator-stats", protectRoute, roomController.getCreatorStats);

// Room by ID (works for both offline and live)
router.get("/:roomId", roomController.getRoomById);

// Creator channel management
router.post("/",                  protectRoute, roomController.upsertRoom);
router.post("/:roomId/go-live",   protectRoute, roomController.goLive);
router.post("/:roomId/go-offline",protectRoute, roomController.goOffline);

// Session actions (auth required)
router.post("/:roomId/join",  protectRoute, roomController.joinRoom);
router.post("/:roomId/leave", protectRoute, roomController.leaveRoom);
router.post("/:roomId/skip",  protectRoute, roomController.skipSong);
router.post("/:roomId/queue", protectRoute, roomController.addToQueue);

// Chat
router.post("/:roomId/chat", protectRoute, roomController.sendChatMessage);

// Favorites
router.post("/:roomId/favorite", protectRoute, roomController.toggleFavorite);

export default router;
