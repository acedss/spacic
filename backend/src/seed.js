// Seed script: populates MongoDB with sample songs and rooms for local testing
// Run: npm run seed
// Note: Songs have placeholder s3Keys — audio won't play, but all UI features work.

import 'dotenv/config';
import mongoose from 'mongoose';
import { Song } from './models/song.model.js';
import { User } from './models/user.model.js';
import { Room } from './models/room.model.js';
import { Listener } from './models/listener.model.js';

const MONGODB_URI = process.env.MONGODB_URI;
const DEV_CLERK_ID = process.env.DEV_CLERK_ID;

// ── Sample Data ──────────────────────────────────────────────────────────────

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
    console.log('✓ Cleared songs, rooms, listeners');

    // Insert songs
    const songs = await Song.insertMany(SONGS);
    console.log(`✓ Inserted ${songs.length} songs`);

    // Create rooms
    const rooms = await Room.insertMany([
        {
            creatorId: creator._id,
            title: 'Late Night Synthwave',
            description: 'Ride the neon wave into the early hours.',
            isPublic: true,
            capacity: 50,
            voteThresholdPercent: 50,
            status: 'active',
            playlist: [songs[0]._id, songs[1]._id, songs[2]._id],
            playback: { currentSongIndex: 0, currentPlaybackTimeMs: 0 },
            streamGoal: 500,
            streamGoalCurrent: 340,
        },
        {
            creatorId: creator._id,
            title: 'Bass Drop Arena',
            description: 'Heavy bass, heavy vibes.',
            isPublic: true,
            capacity: 50,
            voteThresholdPercent: 60,
            status: 'active',
            playlist: [songs[3]._id, songs[4]._id, songs[5]._id],
            playback: { currentSongIndex: 0, currentPlaybackTimeMs: 0 },
            streamGoal: 300,
            streamGoalCurrent: 120,
        },
        {
            creatorId: creator._id,
            title: 'Chill Vibes Only',
            description: 'Low tempo, high mood.',
            isPublic: true,
            capacity: 50,
            voteThresholdPercent: 40,
            status: 'active',
            playlist: [songs[0]._id, songs[2]._id, songs[4]._id],
            playback: { currentSongIndex: 0, currentPlaybackTimeMs: 0 },
            streamGoal: 200,
            streamGoalCurrent: 190,
        },
    ]);
    console.log(`✓ Inserted ${rooms.length} rooms`);

    console.log('\n── Seeded IDs ──────────────────────────────');
    rooms.forEach((r) => console.log(`  Room "${r.title}": ${r._id}`));
    console.log('────────────────────────────────────────────');
    console.log('\nDone! Start the backend with: npm run dev\n');

    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
