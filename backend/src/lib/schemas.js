import { z } from 'zod';

// ── Shared primitives ──────────────────────────────────────────────────────────
const mongoId      = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
const posIntBody   = z.number({ invalid_type_error: 'Must be a number' }).int().positive();
const limitQuery   = z.coerce.number().int().min(1).max(100).default(20);
const offsetQuery  = z.coerce.number().int().min(0).default(0);

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const subscribeSchema = z.object({
    body: z.object({
        slug:         z.string().trim().min(1, 'slug is required'),
        billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
    }),
});

// ── Wallet ────────────────────────────────────────────────────────────────────

export const topupSchema = z.object({
    body: z.object({
        packageId: z.string().trim().min(1, 'packageId is required'),
    }),
});

export const withdrawSchema = z.object({
    body: z.object({
        amount: posIntBody,
    }),
});

// ── Friends ───────────────────────────────────────────────────────────────────

export const searchUsersSchema = z.object({
    query: z.object({
        q:     z.string().max(100).optional(),
        limit: limitQuery,
        skip:  offsetQuery,
    }),
});

export const sendInviteSchema = z.object({
    body: z.object({
        friendId: mongoId,
        roomId:   mongoId,
    }),
});

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const getPublicRoomsSchema = z.object({
    query: z.object({
        sort:   z.enum(['listeners', 'listener_count', 'new', 'trending', 'donations']).optional(),
        limit:  z.coerce.number().int().min(1).max(100).default(50),
        offset: offsetQuery,
        search: z.string().max(100).optional(),
        status: z.enum(['live', 'closed', 'draft']).optional(),
        tag:    z.string().max(50).optional(),
        tags:   z.string().max(200).optional(),
    }),
});

export const addToQueueSchema = z.object({
    body: z.object({
        songId: mongoId,
    }),
});

export const sendChatMessageSchema = z.object({
    body: z.object({
        message: z.string().trim().min(1).max(500),
    }),
});

export const trackReferralSchema = z.object({
    body: z.object({
        ref:  z.string().min(1),
        type: z.enum(['link', 'activity_join']),
    }),
});

// ── Feature flags ─────────────────────────────────────────────────────────────
// All keys optional — PATCH semantics. Non-boolean values are rejected by Zod.

export const updateFeatureFlagsSchema = z.object({
    body: z.object({
        liveMic:    z.boolean().optional(),
        chat:       z.boolean().optional(),
        donations:  z.boolean().optional(),
        voting:     z.boolean().optional(),
        minigames:  z.boolean().optional(),
        voteQueue:  z.boolean().optional(),
        broadcasts: z.boolean().optional(),
    }).strict(),
});
