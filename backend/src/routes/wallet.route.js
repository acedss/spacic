import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as walletController from "../controllers/wallet.controller.js";

const router = Router();

// Note: /topup/webhook is registered directly on the Express app in index.js
// (before express.json()) so Stripe's signature verification gets the raw body.

// All other wallet routes require auth
router.use(protectRoute);

router.get("/packages", walletController.getPackages);
router.get("/", walletController.getWallet);
router.post("/topup", walletController.createTopupSession);

export default router;
