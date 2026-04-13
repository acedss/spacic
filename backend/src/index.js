import 'dotenv/config';
import express from 'express';
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { connectDB } from "./lib/db.js";
import { initializeSocket } from "./lib/socket.js";
import { initCron } from "./lib/cron.js";
import authRoutes from "./routes/auth.route.js"
import adminRoutes from "./routes/admin.route.js"
import songRoutes from './routes/song.route.js';
import roomRoutes from './routes/room.route.js';
import walletRoutes from './routes/wallet.route.js';
import subscriptionRoutes from './routes/subscription.route.js';
import friendRoutes from './routes/friend.route.js';
import playlistRoutes from './routes/playlist.route.js';
import minigameRoutes from './routes/minigame.route.js';
import { handleWebhook } from './controllers/wallet.controller.js';
import { handleClerkWebhook } from './controllers/auth.controller.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust Nginx reverse proxy — required for correct IP detection behind Cloudflare + Nginx
app.set('trust proxy', 1);

const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

app.use(helmet());


const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());

app.use(cors({
    origin: (origin, cb) => {
        // Allow requests with no origin (server-to-server, Postman, webhooks)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clerk-Auth-Token', 'x-dev-token'],
    credentials: true,
}));

// ── Clerk webhook — MUST be before express.json() (Svix needs raw body for signature verification) ──
app.post(
    '/api/webhooks/clerk',
    express.raw({ type: 'application/json' }),
    handleClerkWebhook,
);

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
// Prefer Cloudflare real IP; normalize IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
const realIp = (req) => {
    const ip = req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

// Global: 200 req / 15 min per IP
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    keyGenerator: realIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
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
        validate: { keyGeneratorIpFallback: false },
        message: { message: 'Too many payment requests — try again later' },
    }));
}

// Social: prevent invite spam (10/min) and search scraping (30/min)
app.use('/api/friends/invite', rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: realIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    message: { message: 'Too many invites — slow down' },
}));

app.use('/api/friends/search', rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: realIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    message: { message: 'Too many searches — slow down' },
}));

app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/minigames', minigameRoutes);

//  Error handler
app.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = status === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message;
    res.status(status).json({ message });
    if (status === 500) console.log(error);
})

httpServer.listen(PORT, () => {
    console.log("Server running on  http://localhost:" + PORT);
    connectDB();
    initCron();
});
