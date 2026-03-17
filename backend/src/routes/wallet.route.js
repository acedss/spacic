import { Router } from "express";
import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import * as walletController from "../controllers/wallet.controller.js";

const router = Router();

// Stripe webhook — MUST use raw body, MUST be before any json() middleware.
// Mounted directly on the router (protectRoute is NOT applied — Stripe has no JWT).
router.post(
    "/topup/webhook",
    express.raw({ type: "application/json" }),
    walletController.handleWebhook
);

// All other wallet routes require auth
router.use(protectRoute);

router.get("/packages", walletController.getPackages);
router.get("/", walletController.getWallet);
router.post("/topup", walletController.createTopupSession);

export default router;
