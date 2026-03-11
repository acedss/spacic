import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as roomController from "../controllers/room.controller.js";

const router = Router();

// Discovery (public, no auth required)
router.get("/public", roomController.getPublicRooms);
router.get("/:roomId", roomController.getRoomById);

// Room lifecycle (auth required)
router.post("/", protectRoute, roomController.createRoom);
router.post("/:roomId/join", protectRoute, roomController.joinRoom);
router.post("/:roomId/leave", protectRoute, roomController.leaveRoom);
router.post("/:roomId/close", protectRoute, roomController.closeRoom);

// Creator controls (auth required; creator check is in service layer)
router.post("/:roomId/skip", protectRoute, roomController.skipSong);
router.post("/:roomId/queue", protectRoute, roomController.addToQueue);

// Chat
router.post("/:roomId/chat", protectRoute, roomController.sendChatMessage);

export default router;
