import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb'
import { clerkMiddleware } from "@clerk/express";
import dotenv from 'dotenv';
import { createServer } from "http";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;


const httpServer = createServer(app);

app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/auth", authRoutes);
app.get("/", (req, res) => {
    res.send("Auth Service is running...");
});


//  Error handler
app.use((error, req, res, next) => {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
    console.log(error)
})

httpServer.listen(PORT, () => {
    console.log("Server running on  http://localhost:" + PORT);
    connectDB()
});

