import { Router } from "express";
import { requireAdmin, protectRoute } from "../middlewares/auth.middleware.js";
import { checkAdmin } from "../controllers/admin.controller.js";

const router = Router();

router.use(protectRoute, requireAdmin);

router.get("/check", checkAdmin);

export default router;