import 'dotenv/config';
import express from 'express';
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { connectDB } from "./lib/db.js";
import { initializeSocket } from "./lib/socket.js";
import authRoutes from "./routes/auth.route.js"
import adminRoutes from "./routes/admin.route.js"
import songRoutes from './routes/song.route.js';
import roomRoutes from './routes/room.route.js';
import walletRoutes from './routes/wallet.route.js';
import subscriptionRoutes from './routes/subscription.route.js';
import { handleWebhook } from './controllers/wallet.controller.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust Nginx reverse proxy — required for correct IP detection behind Cloudflare + Nginx
app.set('trust proxy', 1);

const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

app.use(helmet());

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clerk-Auth-Token', 'x-dev-token'],
    credentials: true,
}));

// ── Stripe webhook — MUST be registered BEFORE express.json() AND rate limiters ──
// Reasons:
// 1. express.json() consumes the body stream; constructEvent() needs raw bytes to
//    verify the HMAC signature.
// 2. Rate limiters use prefix matching — /api/wallet/topup matches /api/wallet/topup/webhook.
//    Stripe sends bursts of events; signature verification is the security layer here.
app.post(
    '/api/wallet/topup/webhook',
    express.raw({ type: 'application/json' }),
    handleWebhook,
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Cloudflare passes the real visitor IP in cf-connecting-ip.
// Behind Nginx + CF, req.ip is the Nginx IP — use the CF header directly.
const realIp = (req) => req.headers['cf-connecting-ip'] || req.ip;

// Global: 200 req / 15 min per IP
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    keyGenerator: realIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
}));

// Strict: 20 req / 15 min on payment initiation endpoints (prevents card-testing)
// Skipped in dev — both test accounts share 127.0.0.1 and exhaust each other's quota.
if (process.env.NODE_ENV !== 'development') {
    app.use(['/api/wallet/topup', '/api/subscriptions/subscribe'], rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        keyGenerator: realIp,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Too many payment requests — try again later' },
    }));
}

app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

//  Error handler
app.use((error, req, res, next) => {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
    console.log(error)
})

httpServer.listen(PORT, () => {
    console.log("Server running on  http://localhost:" + PORT);
    connectDB()

});

