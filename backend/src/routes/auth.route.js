import { Router } from "express";
import { authCallback, syncProfile, updateUsername } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/callback",     authCallback);
router.post("/sync-profile", protectRoute, syncProfile);
router.patch("/username",    protectRoute, updateUsername);

export default router;
