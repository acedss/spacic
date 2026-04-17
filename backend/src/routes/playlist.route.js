import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as playlistController from "../controllers/playlist.controller.js";

const router = Router();

router.get("/",      protectRoute, playlistController.getMyPlaylists);
router.post("/",     protectRoute, playlistController.createPlaylist);
router.patch("/:id", protectRoute, playlistController.updatePlaylist);
router.delete("/:id",protectRoute, playlistController.deletePlaylist);

export default router;
