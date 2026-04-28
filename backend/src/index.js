import 'dotenv/config';
import express from 'express';
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';

import { connectDB } from "./lib/db.js";
import { redis } from "./lib/redis.js";
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
import recsysRoutes from './routes/recsys.route.js';
import broadcastAssetRoutes from './routes/broadcastAsset.route.js';
import notificationRoutes from './routes/notification.route.js';
import userRoutes from './routes/user.route.js';
import { handleWebhook } from './controllers/wallet.controller.js';
import { handleClerkWebhook } from './controllers/auth.controller.js';

// ── Startup env validation ────────────────────────────────────────────────────
// Fail fast with a clear message instead of a cryptic runtime error deep inside
// a request handler. Production enforces all payment + storage vars; dev only
// requires the three vars needed to start without Stripe/S3.
const REQUIRED_ENV_ALWAYS = ['MONGODB_URI', 'REDIS_URL', 'CLERK_SECRET_KEY'];
const REQUIRED_ENV_PROD   = [
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLERK_WEBHOOK_SECRET',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME',
];
const toValidate = process.env.NODE_ENV === 'production'
    ? [...REQUIRED_ENV_ALWAYS, ...REQUIRED_ENV_PROD]
    : REQUIRED_ENV_ALWAYS;
const missingEnv = toValidate.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error(`[Config] Missing required environment variables:\n  ${missingEnv.join('\n  ')}`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Trust Nginx reverse proxy — required for correct IP detection behind Cloudflare + Nginx
app.set('trust proxy', 1);

const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

app.use(helmet());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim());

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

// ── Clerk webhook — MUST be before express.json() (Svix needs raw body) ──────
app.post(
    '/api/webhooks/clerk',
    express.raw({ type: 'application/json' }),
    handleClerkWebhook,
);

// ── Stripe webhook — MUST be before express.json() AND rate limiters ─────────
// Reasons:
// 1. express.json() consumes the body stream; constructEvent() needs raw bytes.
// 2. Rate limiters prefix-match /api/wallet/topup; Stripe sends event bursts.
app.post(
    '/api/wallet/topup/webhook',
    express.raw({ type: 'application/json' }),
    handleWebhook,
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Cloudflare passes the real visitor IP in cf-connecting-ip.
// Behind Nginx + CF, req.ip is the Nginx IP — use CF header directly.
const realIp = (req) => {
    const ip = req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

// Global: 200 req / 15 min per IP (relaxed to 1000 in dev — React Strict Mode exhausts 200 quickly)
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'development' ? 1000 : 200,
    keyGenerator: realIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
}));

// Strict: 20 req / 15 min on payment initiation endpoints (prevents card-testing)
// Skipped in dev — test accounts share 127.0.0.1 and exhaust each other's quota.
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

// ── Health check ──────────────────────────────────────────────────────────────
// Returns 200 only when both MongoDB and Redis are reachable.
// Polled by Docker HEALTHCHECK, Jenkins CI, and uptime monitors.
app.get("/health", async (req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    let redisOk = false;
    try {
        await redis.ping();
        redisOk = true;
    } catch { /* redis unreachable */ }

    const ok = mongoOk && redisOk;
    res.status(ok ? 200 : 503).json({
        status: ok ? 'ok' : 'degraded',
        mongo: mongoOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/minigames', minigameRoutes);
app.use('/api/recs', recsysRoutes);
app.use('/api/broadcast-assets', broadcastAssetRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((error, req, res, next) => {
    let status;
    let clientMessage;

    // Mongoose CastError: invalid ObjectId in a route param (:roomId, :songId, …)
    // is a client error — the caller sent a malformed ID, not a server fault.
    if (error.name === 'CastError') {
        status = 400;
        clientMessage = `Invalid value for field '${error.path}'`;
    } else if (error.name === 'ValidationError') {
        // Mongoose ValidationError: a schema constraint was violated on a DB write.
        status = 422;
        clientMessage = Object.values(error.errors).map(e => e.message).join(', ');
    } else {
        status = error.statusCode || 500;
        clientMessage = status === 500 && process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message;
    }

    res.status(status).json({ message: clientMessage });

    // Structured single-line log — every API failure (4xx + 5xx) shows up in
    // Grafana under `[Error] api.request_failed`. Stack only on 5xx to keep
    // the high-volume 4xx lines small.
    process.stderr.write(`[Error] api.request_failed ${JSON.stringify({
        method: req.method,
        path: req.originalUrl?.split('?')[0],
        status,
        errorName: error.name,
        message: error.message,
        ...(status >= 500 ? { stack: error.stack } : {}),
    })}\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Docker sends SIGTERM on `docker compose down`; Ctrl-C sends SIGINT.
// Stop accepting new connections first, then drain DB + Redis, then exit cleanly.
const shutdown = async (signal) => {
    console.log(`[Shutdown] ${signal} received — closing gracefully`);
    httpServer.close(async () => {
        try {
            await mongoose.connection.close();
            redis.disconnect();
            console.log('[Shutdown] Clean exit');
        } catch (err) {
            console.error('[Shutdown] Cleanup error:', err.message);
        }
        process.exit(0);
    });
    // Force exit after 10 s if in-flight requests do not drain
    setTimeout(() => {
        console.error('[Shutdown] Graceful close timed out — forcing exit');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch-all process error handlers. Without these, a stray async function that
// rejects without `.catch()` would print only Node's default warning and the
// failure would never surface in Grafana. We log structured then keep running
// for unhandledRejection (recoverable) but exit on uncaughtException (state
// is undefined after a sync throw).
process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[Error] process.unhandled_rejection ${JSON.stringify({
        message: reason?.message ?? String(reason),
        stack: reason?.stack,
    })}\n`);
});
process.on('uncaughtException', (err) => {
    process.stderr.write(`[Error] process.uncaught_exception ${JSON.stringify({
        message: err?.message,
        stack: err?.stack,
    })}\n`);
    process.exit(1);
});

// Mongoose connection-level errors — these fire after initial connect, e.g.
// when Atlas drops the pool. Different from connectDB() errors at startup.
mongoose.connection.on('error', (err) => {
    process.stderr.write(`[Error] mongo.connection_error ${JSON.stringify({
        message: err?.message,
    })}\n`);
});
mongoose.connection.on('disconnected', () => {
    process.stderr.write(`[Error] mongo.disconnected {}\n`);
});

// ── Server startup ────────────────────────────────────────────────────────────
// Connect to MongoDB before binding the port to avoid the race where the first
// HTTP request arrives before Mongoose has an established connection.
const startServer = async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        console.log(`[Server] Running on http://localhost:${PORT}`);
        initCron();
    });
};

startServer().catch((err) => {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
});
