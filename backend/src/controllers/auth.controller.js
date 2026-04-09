import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { Webhook } from "svix";

export const authCallback = async (req, res, next) => {
    try {
        const { clerkId, fullName, imageUrl, role, username } = req.body;

        const update = { fullName, imageUrl };
        if (username) update.username = username.toLowerCase();

        await User.findOneAndUpdate(
            { clerkId },
            { $setOnInsert: { clerkId, role: role ?? 'USER', balance: 0 }, $set: update },
            { upsert: true }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

// PATCH /auth/username — updates via Clerk Backend SDK (no re-verification required)
export const updateUsername = async (req, res, next) => {
    try {
        const clerkId = req.auth?.userId;
        const { username } = req.body;

        if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ message: 'Invalid username: 3–20 chars, lowercase letters, numbers, or underscores only' });
        }

        // Admin-side Clerk update — bypasses re-verification requirement
        await clerkClient.users.updateUser(clerkId, { username });

        // Mirror to MongoDB
        const user = await User.findOneAndUpdate(
            { clerkId },
            { $set: { username: username.toLowerCase() } },
            { new: true, select: 'username' }
        );

        res.json({ success: true, data: user });
    } catch (error) {
        // Clerk throws 422 when username is already taken
        if (error.status === 422 || error.clerkError) {
            const msg = error.errors?.[0]?.longMessage ?? 'Username already taken';
            return res.status(422).json({ message: msg });
        }
        next(error);
    }
};

// POST /auth/sync-profile — re-sync Clerk profile fields to MongoDB (called after UserProfile updates)
export const syncProfile = async (req, res, next) => {
    try {
        const clerkId = req.auth?.userId;
        const { username, fullName, imageUrl } = req.body;

        const update = {};
        if (fullName) update.fullName = fullName;
        if (imageUrl) update.imageUrl = imageUrl;
        if (username) update.username = username.toLowerCase();

        const user = await User.findOneAndUpdate(
            { clerkId },
            { $set: update },
            { new: true, select: 'username fullName imageUrl' }
        );

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// POST /webhooks/clerk — Svix-verified Clerk webhook (user.created / user.updated)
export const handleClerkWebhook = async (req, res) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: 'CLERK_WEBHOOK_SECRET not configured' });

    const wh = new Webhook(secret);
    let evt;
    try {
        evt = wh.verify(req.body, {
            'svix-id': req.headers['svix-id'],
            'svix-timestamp': req.headers['svix-timestamp'],
            'svix-signature': req.headers['svix-signature'],
        });
    } catch {
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { type, data } = evt;

    try {
        if (type === 'user.created' || type === 'user.updated') {
            const { id: clerkId, username, first_name, last_name, image_url, email_addresses } = data;
            const fullName = [first_name, last_name].filter(Boolean).join(' ')
                || email_addresses?.[0]?.email_address
                || 'Unknown';

            const update = {
                fullName: fullName || 'Unknown',
                imageUrl: image_url || '',
            };
            if (username) update.username = username.toLowerCase();

            await User.findOneAndUpdate(
                { clerkId },
                { $setOnInsert: { clerkId, role: 'USER', balance: 0 }, $set: update },
                { upsert: true }
            );
            console.log(`[Clerk Webhook] ${type} — synced user ${clerkId}`);
        }
    } catch (err) {
        // Log but always return 200 — Clerk retries on non-2xx, causing duplicate processing
        console.error('[Clerk Webhook] DB sync error:', err.message);
    }

    res.json({ received: true });
};
