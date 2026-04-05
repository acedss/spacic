// Seed script: populates MongoDB with sample songs and rooms for local testing
// Run: npm run seed
// Note: Songs have placeholder s3Keys — audio won't play, but all UI features work.

import 'dotenv/config';
import mongoose from 'mongoose';
import { Song } from './models/song.model.js';
import { User } from './models/user.model.js';
import { Room } from './models/room.model.js';
import { Listener } from './models/listener.model.js';
import { TopupPackage } from './models/topupPackage.model.js';
import { SubscriptionPlan } from './models/subscriptionPlan.model.js';
import { Transaction } from './models/transaction.model.js';

const MONGODB_URI = process.env.MONGODB_URI;
const DEV_CLERK_ID = process.env.DEV_CLERK_ID;

// ── Seed Data ────────────────────────────────────────────────────────────────

const TOPUP_PACKAGES = [
    { packageId: 'starter', name: 'Starter',  priceUsd: 500,  credits: 500,  bonusPercent: 0,  isFeatured: false, sortOrder: 0 },
    { packageId: 'popular', name: 'Popular',  priceUsd: 1000, credits: 1100, bonusPercent: 10, isFeatured: true,  sortOrder: 1 },
    { packageId: 'value',   name: 'Value',    priceUsd: 2500, credits: 2750, bonusPercent: 10, isFeatured: false, sortOrder: 2 },
    { packageId: 'power',   name: 'Power',    priceUsd: 5000, credits: 6000, bonusPercent: 20, isFeatured: false, sortOrder: 3 },
];

const SUBSCRIPTION_PLANS = [
    {
        slug: 'premium',
        name: 'Premium',
        tier: 'PREMIUM',
        priceMonthlyUsd: 999,   // $9.99/mo
        priceYearlyUsd: 9588,   // $95.88/yr (20% off)
        features: [
            'Host rooms up to 50 listeners',
            'HD audio quality',
            'Custom room themes',
            'Priority support',
        ],
        roomCapacity: 50,
        sortOrder: 0,
    },
    {
        slug: 'creator',
        name: 'Creator',
        tier: 'CREATOR',
        priceMonthlyUsd: 1999,  // $19.99/mo
        priceYearlyUsd: 19188,  // $191.88/yr (20% off)
        features: [
            'Unlimited room listeners',
            'HD audio quality',
            'Custom room themes',
            'Stream goal & donations',
            'Analytics dashboard',
            'Priority support',
            'Early access to new features',
        ],
        roomCapacity: 999999,   // effectively unlimited
        sortOrder: 1,
    },
];

// ── Sample Song Data ──────────────────────────────────────────────────────────

const SONGS = [
    {
        title: 'God Is',
        artist: 'Kanye West',
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/God Is.mp3',
        duration: 214,
    },
    {
        title: 'SZA - Open Arms (Official Audio) ft. Travis Scott',
        artist: 'SZA ft. Travis Scott',
        imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/SZA - Open Arms (Official Audio) ft. Travis Scott.mp3',
        duration: 187,
    },
    {
        title: 'Save Your Tears',
        artist: 'The Weeknd',
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/The Weeknd - Save Your Tears (Official Music Video).mp3',
        duration: 243,
    },
    {
        title: 'One Of The Girls',
        artist: 'The Weeknd, JENNIE & Lily Rose Depp',
        imageUrl: 'https://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/The Weeknd, JENNIE & Lily Rose Depp - One Of The Girls (Official Audio).mp3',
        duration: 198,
    },
    {
        title: 'Die For You (Remix)',
        artist: 'The Weeknd, Ariana Grande',
        imageUrl: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/The Weeknd, Ariana Grande - Die For You (Remix  Lyric Video).mp3',
        duration: 231,
    },
    {
        title: 'I Wonder',
        artist: 'Kanye West',
        imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
        s3Key: 'songs/I Wonder.mp3',
        duration: 205,
    }
];

// ── Main ─────────────────────────────────────────────────────────────────────

const seed = async () => {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Find the dev user (must already exist — created via Clerk auth-callback)
    const creator = await User.findOne({ clerkId: DEV_CLERK_ID });
    if (!creator) {
        console.error(`✗ Dev user not found (clerkId: ${DEV_CLERK_ID})`);
        console.error('  → Log in to the app once via Clerk to create your user, then re-run seed.');
        process.exit(1);
    }
    console.log(`✓ Found dev user: ${creator.fullName} (${creator._id})`);

    // Wipe existing seed data
    await Song.deleteMany({});
    await Room.deleteMany({});
    await Listener.deleteMany({});
    await TopupPackage.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    await Transaction.deleteMany({ userId: creator._id });
    console.log('✓ Cleared songs, rooms, listeners, packages, plans, transactions');

    // Insert songs
    const songs = await Song.insertMany(SONGS);
    console.log(`✓ Inserted ${songs.length} songs`);

    // Create one permanent room for the dev creator (Twitch-channel model: one room per creator)
    const liveAt = new Date();
    const rooms = await Room.insertMany([
        {
            creatorId: creator._id,
            title: 'Late Night Synthwave',
            description: 'Ride the neon wave into the early hours.',
            isPublic: true,
            capacity: 50,
            voteThresholdPercent: 50,
            status: 'live',
            liveAt,
            playlist: songs.map((s) => s._id),
            playback: { currentSongIndex: 0, startTimeUnix: liveAt.getTime(), pausedAtMs: 0 },
            streamGoal: 500,
            streamGoalCurrent: 0,
            escrow: 0,
            stats: {
                totalSessions: 2, totalListeners: 48, totalMinutesListened: 312,
                totalCoinsEarned: 1200, totalDonors: 8, peakListeners: 22,
                topDonors: [{ name: 'DevUser', totalCoins: 800 }],
                lastLiveAt: new Date(Date.now() - 86_400_000),
                lastOfflineAt: new Date(Date.now() - 82_800_000),
            },
            sessions: [
                { startedAt: new Date(Date.now() - 2 * 86_400_000), endedAt: new Date(Date.now() - 2 * 86_400_000 + 3_600_000), listenerCount: 25, minutesListened: 180, coinsEarned: 700, topDonors: [] },
                { startedAt: new Date(Date.now() - 86_400_000), endedAt: new Date(Date.now() - 82_800_000), listenerCount: 23, minutesListened: 132, coinsEarned: 500, topDonors: [{ name: 'DevUser', totalCoins: 500 }] },
            ],
        },
    ]);
    console.log(`✓ Inserted ${rooms.length} room (permanent channel)`);

    // Insert top-up packages
    const packages = await TopupPackage.insertMany(TOPUP_PACKAGES);
    console.log(`✓ Inserted ${packages.length} top-up packages`);

    // Insert subscription plans
    const plans = await SubscriptionPlan.insertMany(SUBSCRIPTION_PLANS);
    console.log(`✓ Inserted ${plans.length} subscription plans`);

    // Seed transaction history for dev user
    // Mix of topups and donations spanning the last month
    const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
    const txDocs = [
        { userId: creator._id, type: 'topup',    amount: 1100,  status: 'completed', stripeSessionId: 'cs_seed_001', createdAt: daysAgo(28) },
        { userId: creator._id, type: 'donation', amount: 200,   status: 'completed', donorName: creator.fullName, roomId: rooms[0]._id, createdAt: daysAgo(25) },
        { userId: creator._id, type: 'topup',    amount: 2750,  status: 'completed', stripeSessionId: 'cs_seed_002', createdAt: daysAgo(18) },
        { userId: creator._id, type: 'donation', amount: 500,   status: 'completed', donorName: creator.fullName, roomId: rooms[0]._id, createdAt: daysAgo(15) },
        { userId: creator._id, type: 'donation', amount: 300,   status: 'completed', donorName: creator.fullName, roomId: rooms[0]._id, createdAt: daysAgo(10) },
        { userId: creator._id, type: 'topup',    amount: 6000,  status: 'completed', stripeSessionId: 'cs_seed_003', createdAt: daysAgo(5) },
        { userId: creator._id, type: 'donation', amount: 1000,  status: 'completed', donorName: creator.fullName, roomId: rooms[0]._id, createdAt: daysAgo(2) },
        { userId: creator._id, type: 'donation', amount: 150,   status: 'completed', donorName: creator.fullName, roomId: rooms[0]._id, createdAt: daysAgo(1) },
    ];
    await Transaction.insertMany(txDocs);
    // balance = topups - donations: 1100+2750+6000 - 200-500-300-1000-150 = 7700
    const seedBalance = 7700;
    await creator.updateOne({ balance: seedBalance });
    console.log(`✓ Inserted ${txDocs.length} transactions, balance set to ${seedBalance} credits ($${(seedBalance/100).toFixed(2)})`);

    console.log('\n── Seeded IDs ──────────────────────────────');
    rooms.forEach((r) => console.log(`  Room "${r.title}": ${r._id}`));
    packages.forEach((p) => console.log(`  Package "${p.name}": ${p.packageId}`));
    plans.forEach((p) => console.log(`  Plan "${p.name}": ${p.slug}`));
    console.log('────────────────────────────────────────────');
    console.log('\nDone! Start the backend with: npm run dev\n');

    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
