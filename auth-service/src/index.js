import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb'
import { clerkMiddleware } from "@clerk/express";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        strict: true,
        version: ServerApiVersion.v1,
        deprecationErrors: true,
    }
});

client.connect().then(() => {
    console.log("Connected to MongoDB");
}).catch(err => {
    console.error("Failed to connect to MongoDB", err);
});





