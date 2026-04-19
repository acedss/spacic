import { Router } from "express";
import { authCallback, syncProfile, updateUsername, completeOnboarding, getOnboardingStatus, getOnboardingData } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/callback",     authCallback);
router.post("/sync-profile", protectRoute, syncProfile);
router.patch("/username",    protectRoute, updateUsername);
router.post("/onboarding/complete", protectRoute, completeOnboarding);
router.get("/onboarding/status",    protectRoute, getOnboardingStatus);
router.get("/onboarding/data",      protectRoute, getOnboardingData);

export default router;
