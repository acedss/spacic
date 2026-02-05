import express from 'express';
import { clerkMiddleware } from "@clerk/express";
import dotenv from 'dotenv';
import { createServer } from "http";
import cors from 'cors';

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js"
import adminRoutes from "./routes/admin.route.js"

import songRoutes from './routes/song.route.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;


const httpServer = createServer(app);

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clerk-Auth-Token'],
    credentials: true,
}));
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/songs', songRoutes)

//  Error handler
app.use((error, req, res, next) => {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
    console.log(error)
})

httpServer.listen(PORT, () => {
    console.log("Server running on  http://localhost:" + PORT);
    connectDB()

});

