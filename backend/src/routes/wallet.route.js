import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idempotency } from "../middlewares/idempotency.js";
import { topupSchema, withdrawSchema } from "../lib/schemas.js";
import * as walletController from "../controllers/wallet.controller.js";

const router = Router();

// Note: /topup/webhook is registered directly on the Express app in index.js
// (before express.json()) so Stripe's signature verification gets the raw body.

// All other wallet routes require auth
router.use(protectRoute);

router.get("/packages",         walletController.getPackages);
router.get("/",                 walletController.getWallet);
router.post("/topup",           idempotency(), validate(topupSchema), walletController.createTopupSession);

// Stripe Connect (creator payouts)
router.get("/connect/status",   walletController.getConnectStatus);
router.post("/connect/onboard", walletController.onboardConnect);
router.get("/connect/return",   walletController.handleConnectReturn);

// WinPoints withdrawal
router.post("/withdraw",        idempotency(), validate(withdrawSchema), walletController.withdrawWinPoints);

export default router;
