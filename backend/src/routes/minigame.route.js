import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as minigameController from "../controllers/minigame.controller.js";

const router = Router();

// Per-room: list + create
router.get("/rooms/:roomId",  protectRoute, minigameController.getMinigamesForRoom);
router.post("/rooms/:roomId", protectRoute, minigameController.createMinigame);

// Individual game: edit + delete
router.patch("/:id",  protectRoute, minigameController.updateMinigame);
router.delete("/:id", protectRoute, minigameController.deleteMinigame);

export default router;
