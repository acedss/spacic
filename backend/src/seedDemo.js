// Demo seed: oldies-themed dataset for the FYP backup video.
//
// Wipes Songs/Rooms/Listeners/Friendships/RoomFavorites/SongReactions/Transactions
// (scoped to seed users), then inserts:
//   • 31 songs from songs.manifest.json with cleaned titles + corrected artists.
//   • 4 demo creators (one room each — Twitch-channel model).
//   • 4 demo listeners + the dev user as a 5th listener.
//   • 4 themed rooms: Midnight Standards, Doo-Wop Diner, Soul & Slow Jams, Modern R&B Lounge.
//   • Friendships between every listener and every creator (accepted).
//   • Room favorites — each listener stars 2-3 rooms.
//   • Song reactions (likes scattered).
//   • Donation transactions filling room.streamGoalCurrent and topDonors.
//
// Run: npm run seed:demo
// Idempotent: safe to re-run; clears prior demo data first.

import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { putObject } from './services/s3.services.js';
import { Song } from './models/song.model.js';
import { User } from './models/user.model.js';
import { Room } from './models/room.model.js';
import { Listener } from './models/listener.model.js';
import { Friendship } from './models/friendship.model.js';
import { RoomFavorite } from './models/roomFavorite.model.js';
import { SongReaction } from './models/songReaction.model.js';
import { Transaction } from './models/transaction.model.js';
import { TopupPackage } from './models/topupPackage.model.js';
import { SubscriptionPlan } from './models/subscriptionPlan.model.js';
import { SongPlay } from './models/songPlay.model.js';
import { SongDailyStat } from './models/songDailyStat.model.js';
import { UserDailyStat } from './models/userDailyStat.model.js';
import { ListenEvent } from './models/listenEvent.model.js';
import { RoomStats } from './models/room-stats.model.js';
import { Artist } from './models/artist.model.js';
import { Album } from './models/album.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, 'scripts', 'songs.manifest.json');

const MONGODB_URI = process.env.MONGODB_URI;
const DEV_CLERK_ID = process.env.DEV_CLERK_ID || 'user_383URuiYNKZtUx9xn1aNla2meRe';

// ── Title/artist cleanup ──────────────────────────────────────────────────────
// YouTube ID3 frequently has noise like "(Official Music Video)" in the title
// and uploader-credit garbage in the artist field. Normalize for nicer display.
const cleanTitle = (t) => t
    .replace(/\s*\((Official\s*)?(Music\s*)?(Video|Audio|Lyrics?|Live|Lyric Video|legendado)[^)]*\)/gi, '')
    .replace(/\s*\[(Official\s*)?(Music\s*)?(Video|Audio)[^\]]*\]/gi, '')
    .replace(/^Song\s*-\s*/i, '')
    .replace(/\s+\(Live\).*$/i, '')
    .replace(/\s*–\s*/g, ' – ')
    .replace(/\s+/g, ' ')
    .trim();

// Override artist for files where ID3 was wrong (uploader name, label, etc.)
// Key matches against the s3Key (or filename); first match wins.
const ARTIST_OVERRIDES = [
    { match: 'Bobby_McFerrin',                  artist: 'Bobby McFerrin' },
    { match: 'Frankie_Valli',                   artist: 'Frankie Valli' },
    { match: 'Grover_Washington',               artist: 'Grover Washington Jr. ft. Bill Withers' },
    { match: 'Edward_Sharpe',                   artist: 'Edward Sharpe & The Magnetic Zeros' },
    { match: 'H.E.R.',                          artist: 'H.E.R. ft. Daniel Caesar' },
    { match: 'Lady_Gaga_Bruno_Mars',            artist: 'Lady Gaga & Bruno Mars' },
    { match: 'Mr._Sandman',                     artist: 'The Chordettes' },
    { match: 'Paul_Anka',                       artist: 'Paul Anka' },
    { match: 'Sam_Smith',                       artist: 'Sam Smith' },
    { match: 'giveon_-_if_i_ain_t_got_you',     artist: 'Giveon' },
    { match: 'All_That_I_Know',                 artist: 'ZUHAIR & Kobe White' },
    { match: 'Kendrick_Lamar_SZA',              artist: 'Kendrick Lamar & SZA' },
];
const overrideArtist = (s3Key, fallback) => {
    const hit = ARTIST_OVERRIDES.find(o => s3Key.includes(o.match));
    return hit ? hit.artist : fallback;
};

// ── Theme buckets — match s3Key fragments to a room theme ────────────────────
// Order matters: first room that claims a song wins. Anything unmatched goes
// to Modern R&B Lounge as the catch-all.
const THEME_RULES = [
    {
        room: 'midnight-standards',
        match: [
            'A_Kiss_To_Build_A_Dream_On', 'Frank_Sinatra', 'L-O-V-E',
            'Louis_Armstrong', 'Frankie_Valli', 'Paul_Anka',
        ],
    },
    {
        room: 'doo-wop-diner',
        match: [
            'Mr._Sandman', 'The_Ronettes', 'The_Platters',
            'Raindrops_Keep_Falling', 'Bobby_McFerrin',
        ],
    },
    {
        room: 'soul-slow-jams',
        match: [
            'Grover_Washington', 'What_You_Won_t_Do_for_Love',
            'H.E.R.', 'Durand_Jones', 'Edward_Sharpe',
        ],
    },
    // catch-all → modern-rnb-lounge
];
const themeFor = (s3Key) => {
    const hit = THEME_RULES.find(r => r.match.some(m => s3Key.includes(m)));
    return hit?.room ?? 'modern-rnb-lounge';
};

// ── Demo people ───────────────────────────────────────────────────────────────
// Clerk IDs use a `demo_` prefix so they're easy to wipe and never collide
// with real Clerk-issued IDs. Avatars: deterministic Dicebear so every reseed
// looks identical (good for video reproducibility).
const av = (seed) => `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;

const CREATORS = [
    { clerkId: 'demo_creator_vince',   fullName: 'VinylVince',     username: 'vinylvince',   roomKey: 'midnight-standards', roomTitle: 'Midnight Standards',   description: 'Sinatra, Satchmo, and the great American songbook. Smoke a cigar with me.', tags: ['Jazz', 'Late Night', 'Classical'] },
    { clerkId: 'demo_creator_sally',   fullName: 'SugarPopSal',    username: 'sugarpopsal',  roomKey: 'doo-wop-diner',      roomTitle: 'Doo-Wop Diner',        description: 'Pull up a stool — milkshakes, malt-shop hits, and pure 50s sweetness.',         tags: ['Pop', 'Chill', 'Acoustic'] },
    { clerkId: 'demo_creator_marcus',  fullName: 'SoulRevival',    username: 'soulrevival',  roomKey: 'soul-slow-jams',     roomTitle: 'Soul & Slow Jams',     description: 'Quiet storm vibes — neo-soul, 70s grooves, and slow-burn ballads.',             tags: ['Soul', 'R&B', 'Chill'] },
    { clerkId: 'demo_creator_neon',    fullName: 'NeonRnB',        username: 'neonrnb',      roomKey: 'modern-rnb-lounge',  roomTitle: 'Modern R&B Lounge',    description: 'Silk Sonic, SZA, Giveon — the new wave of smooth.',                              tags: ['R&B', 'Pop', 'Lo-fi'] },
];

const LISTENERS = [
    { clerkId: 'demo_listener_lila',  fullName: 'LilaB',     username: 'lilab',     balance: 4500 },
    { clerkId: 'demo_listener_aki',   fullName: 'AkiWaves',  username: 'akiwaves',  balance: 2200 },
    { clerkId: 'demo_listener_juno',  fullName: 'JunoSky',   username: 'junosky',   balance: 8800 },
    { clerkId: 'demo_listener_ren',   fullName: 'RenSilent', username: 'rensilent', balance: 1500 },
];

// Top-up + plan rows mirror seed.js so the wallet/subscription pages render.
const TOPUP_PACKAGES = [
    { packageId: 'starter', name: 'Starter',  priceUsd: 500,  credits: 500,  bonusPercent: 0,  isFeatured: false, sortOrder: 0 },
    { packageId: 'popular', name: 'Popular',  priceUsd: 1000, credits: 1100, bonusPercent: 10, isFeatured: true,  sortOrder: 1 },
    { packageId: 'value',   name: 'Value',    priceUsd: 2500, credits: 2750, bonusPercent: 10, isFeatured: false, sortOrder: 2 },
    { packageId: 'power',   name: 'Power',    priceUsd: 5000, credits: 6000, bonusPercent: 20, isFeatured: false, sortOrder: 3 },
];
const SUBSCRIPTION_PLANS = [
    { slug: 'premium', name: 'Premium', tier: 'PREMIUM', priceMonthlyUsd: 999,  priceYearlyUsd: 9588,  features: ['Host rooms up to 50 listeners', 'HD audio', 'Custom themes', 'Priority support'], roomCapacity: 50, sortOrder: 0 },
    { slug: 'creator', name: 'Creator', tier: 'CREATOR', priceMonthlyUsd: 1999, priceYearlyUsd: 19188, features: ['Unlimited listeners', 'HD audio', 'Custom themes', 'Stream goal', 'Analytics', 'Priority support', 'Early access'], roomCapacity: 999999, sortOrder: 1 },
];

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const minutesAgo = (n) => new Date(Date.now() - n * 60_000);
const pick = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Upload a room cover that mirrors the real upload flow
// (room.controller.js → `images/<userId>/<uuid>.<ext>`). Source image is
// reused from the on-disk song-cover dump that uploadSongsToS3.js writes to
// backend/public/covers — same bytes the songs already serve, so no extra
// asset files are needed.
const PUBLIC_COVERS_DIR = path.resolve(__dirname, '..', 'public', 'covers');
const uploadSeedRoomCover = async (ownerId, sourceImageUrl) => {
    if (!sourceImageUrl) return null;
    const match = sourceImageUrl.match(/\/covers\/([^?#]+)$/);
    if (!match) return null;
    const filename = match[1];
    const localPath = path.join(PUBLIC_COVERS_DIR, filename);
    if (!fs.existsSync(localPath)) return null;
    const buffer = fs.readFileSync(localPath);
    const ext = (path.extname(filename).slice(1) || 'jpg').toLowerCase();
    const key = `images/${ownerId}/${crypto.randomUUID()}.${ext}`;
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    await putObject(key, buffer, mime);
    return key;
};


const seed = async () => {
    if (!MONGODB_URI) throw new Error('MONGODB_URI missing in .env');
    if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`Manifest missing — run uploadSongsToS3.js first: ${MANIFEST_PATH}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // ── Wipe everything seedable ─────────────────────────────────────────────
    // Real users created via Clerk are kept; only demo_* accounts get nuked.
    const allDemoClerkIds = [...CREATORS.map(c => c.clerkId), ...LISTENERS.map(l => l.clerkId)];
    const demoUsers = await User.find({ clerkId: { $in: allDemoClerkIds } }, { _id: 1 });
    const demoUserIds = demoUsers.map(u => u._id);

    await Promise.all([
        Song.deleteMany({}),
        Room.deleteMany({}),
        Listener.deleteMany({}),
        TopupPackage.deleteMany({}),
        SubscriptionPlan.deleteMany({}),
        SongReaction.deleteMany({ userId: { $in: demoUserIds } }),
        RoomFavorite.deleteMany({ userId: { $in: demoUserIds } }),
        Friendship.deleteMany({ $or: [{ requester: { $in: demoUserIds } }, { recipient: { $in: demoUserIds } }] }),
        Transaction.deleteMany({ userId: { $in: demoUserIds } }),
        User.deleteMany({ clerkId: { $in: allDemoClerkIds } }),
        // ── Analytics rollups: nuke entirely ───────────────────────────────
        // These are denormalized rollups keyed by ObjectId. After we re-insert
        // songs/users with new IDs, stale rows would render as "Unknown title"
        // / "Unknown artist" in admin charts because the $lookup misses.
        SongPlay.deleteMany({}),
        SongDailyStat.deleteMany({}),
        UserDailyStat.deleteMany({}),
        ListenEvent.deleteMany({}),
        RoomStats.deleteMany({}),
        Artist.deleteMany({}),
        Album.deleteMany({}),
    ]);
    console.log('✓ Cleared prior demo data');

    // ── Songs ────────────────────────────────────────────────────────────────
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const songDocs = manifest.map((m) => {
        const theme = themeFor(m.s3Key);
        // Quick genre/mood tagging by theme — feeds RecSys + filter UI
        const themeTags = {
            'midnight-standards': { genre: ['jazz'],          mood: ['nostalgic', 'romantic'] },
            'doo-wop-diner':      { genre: ['pop'],           mood: ['happy', 'nostalgic'] },
            'soul-slow-jams':     { genre: ['rnb'],           mood: ['chill', 'romantic'] },
            'modern-rnb-lounge':  { genre: ['rnb', 'pop'],    mood: ['chill', 'romantic'] },
        }[theme];
        return {
            title:    cleanTitle(m.title),
            artist:   overrideArtist(m.s3Key, m.artist),
            imageUrl: m.imageUrl,
            s3Key:    m.s3Key,
            duration: m.duration,
            genre:    themeTags.genre,
            mood:     themeTags.mood,
            language: 'en',
            streamCount: randInt(120, 9500),
            uniquePlays: randInt(80, 4200),
        };
    });
    const songs = await Song.insertMany(songDocs);
    console.log(`✓ Inserted ${songs.length} songs`);

    // ── Artists + Albums + back-link from Song ───────────────────────────────
    // Admin Catalog tab counts straight from Artist/Album collections, so we
    // need real rows. One Artist per unique post-override artist string,
    // one Album per room theme (using the theme's display title).
    const artistNames = [...new Set(songs.map(s => s.artist).filter(Boolean))];
    const artistDocs = await Artist.insertMany(artistNames.map((name) => {
        // Use any one of this artist's song covers as their image
        const ownSong = songs.find(s => s.artist === name);
        return {
            name,
            imageUrl: ownSong?.imageUrl ?? null,
            bio: '', // left blank — admin can edit later
            songCount: songs.filter(s => s.artist === name).length,
        };
    }));
    const artistByName = Object.fromEntries(artistDocs.map(a => [a.name, a]));
    console.log(`✓ Inserted ${artistDocs.length} artists`);

    // One album per theme — represents the curated mix played in that room.
    // We use the most-frequent artist in the theme as the album's artistId,
    // mostly so the Catalog "albums" tab shows non-null artist links.
    const ALBUM_META = {
        'midnight-standards': { title: 'Midnight Standards',  releaseYear: 1962 },
        'doo-wop-diner':      { title: 'Doo-Wop Diner',       releaseYear: 1958 },
        'soul-slow-jams':     { title: 'Soul & Slow Jams',    releaseYear: 1979 },
        'modern-rnb-lounge':  { title: 'Modern R&B Lounge',   releaseYear: 2023 },
    };
    const albumRows = Object.entries(ALBUM_META).map(([key, meta]) => {
        const themedSongs = songs.filter(s => themeFor(s.s3Key) === key);
        // Pick most-frequent artist as album leader
        const tally = themedSongs.reduce((acc, s) => { acc[s.artist] = (acc[s.artist] ?? 0) + 1; return acc; }, {});
        const leader = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        return {
            __themeKey: key,
            title:         meta.title,
            artistId:      leader ? artistByName[leader]?._id ?? null : null,
            artistName:    leader,
            coverImageUrl: themedSongs[0]?.imageUrl ?? null,
            releaseYear:   meta.releaseYear,
            songCount:     themedSongs.length,
        };
    });
    const albumDocs = await Album.insertMany(albumRows.map(({ __themeKey, ...rest }) => rest));
    const albumByTheme = Object.fromEntries(albumRows.map((row, i) => [row.__themeKey, albumDocs[i]]));
    console.log(`✓ Inserted ${albumDocs.length} albums`);

    // Patch each song with artistId + albumId now that those exist.
    await Promise.all(songs.map((s) => Song.updateOne(
        { _id: s._id },
        { $set: {
            artistId: artistByName[s.artist]?._id ?? null,
            albumId:  albumByTheme[themeFor(s.s3Key)]?._id ?? null,
        }},
    )));
    console.log('✓ Patched song.artistId / song.albumId back-links');

    // ── Users (creators + listeners) ─────────────────────────────────────────
    const creatorDocs = await User.insertMany(CREATORS.map(c => ({
        clerkId: c.clerkId,
        fullName: c.fullName,
        username: c.username,
        imageUrl: av(c.username),
        role: 'CREATOR',
        userTier: 'CREATOR',
        balance: 0,
        winPoints: randInt(2000, 15000),
        onboardingCompleted: true,
        creatorStats: {
            totalRoomsHosted: 1,
            totalStreams: randInt(150, 800),
            totalMinutesListened: randInt(2000, 12_000),
            totalWinPointsEarned: randInt(5000, 30_000),
            totalUniqueDonors: randInt(20, 120),
            lastLiveAt: daysAgo(1),
        },
    })));
    const creatorByKey = Object.fromEntries(creatorDocs.map((u, i) => [CREATORS[i].roomKey, u]));
    console.log(`✓ Inserted ${creatorDocs.length} creators`);

    const listenerDocs = await User.insertMany(LISTENERS.map(l => ({
        clerkId: l.clerkId,
        fullName: l.fullName,
        username: l.username,
        imageUrl: av(l.username),
        role: 'USER',
        userTier: 'PREMIUM',
        balance: l.balance,
        winPoints: randInt(0, 800),
        onboardingCompleted: true,
        activityStats: { roomsJoined: randInt(15, 80), gamesPlayed: randInt(0, 25), donationsMade: randInt(2, 30), totalWithdrawn: 0 },
    })));
    console.log(`✓ Inserted ${listenerDocs.length} listeners`);

    // Bring the dev user (created via Clerk) into the social graph if present.
    // Promote to ADMIN/CREATOR + boost balance so the demo recording can show
    // every gated UI without stitching across accounts.
    const devUser = await User.findOne({ clerkId: DEV_CLERK_ID });
    if (devUser) {
        await User.updateOne({ _id: devUser._id }, {
            $set: {
                role: 'ADMIN',
                userTier: 'CREATOR',
                balance: 25_000,
                winPoints: 12_500,
                onboardingCompleted: true,
            },
        });
        console.log(`✓ Promoted dev user: ${devUser.fullName} → ADMIN/CREATOR, 25k coins`);
    }

    // ── Rooms ────────────────────────────────────────────────────────────────
    // All four rooms go LIVE so the Discover page is populated for the demo.
    // Each room owns the songs that themed to its bucket.
    const songsByTheme = songs.reduce((acc, s) => {
        const t = themeFor(s.s3Key);
        (acc[t] ??= []).push(s);
        return acc;
    }, {});

    // If dev user exists, add a 5th room owned by them — needed so the
    // Studio + Settings + Live-creator UIs work during recording.
    const ROOM_BLUEPRINTS = CREATORS.map((c, i) => ({ ...c, _ownerId: creatorDocs[i]._id }));
    if (devUser) {
        ROOM_BLUEPRINTS.push({
            roomKey: 'spacic-studio-lab',
            roomTitle: 'Spacic Studio Lab',
            description: 'A curated mix from across the eras — testing new features live.',
            tags: ['Indie', 'Lo-fi', 'Focus'],
            _ownerId: devUser._id,
        });
        // Tag a curated subset of songs to this lab room
        songsByTheme['spacic-studio-lab'] = pick(songs, Math.min(10, songs.length));
    }

    const roomBlueprints = await Promise.all(ROOM_BLUEPRINTS.map(async (c) => {
        const themedSongs = songsByTheme[c.roomKey] ?? [];
        const liveAt = minutesAgo(randInt(10, 90));
        // Reuse the first themed song's artwork as the room cover. Uploads to
        // S3 under the same `images/<userId>/<uuid>.<ext>` convention as the
        // real room-edit upload flow, so withCoverUrl() presigns it normally.
        const coverImageUrl = await uploadSeedRoomCover(c._ownerId, themedSongs[0]?.imageUrl);
        return {
            creatorId: c._ownerId,
            title: c.roomTitle,
            description: c.description,
            isPublic: true,
            capacity: 999999,
            voteThresholdPercent: 50,
            status: 'live',
            liveAt,
            playlist: themedSongs.map(s => s._id),
            playback: { currentSongIndex: 0, startTimeUnix: liveAt.getTime(), pausedAtMs: 0, lastSyncAt: new Date() },
            streamGoal: 1000,
            streamGoalCurrent: randInt(120, 850),
            escrow: 0,
            tags: c.tags,
            coverImageUrl,
            favoriteCount: randInt(40, 600),
            stats: {
                totalSessions: randInt(8, 35),
                totalListeners: randInt(120, 900),
                totalMinutesListened: randInt(1500, 18_000),
                totalCoinsEarned: randInt(2000, 25_000),
                totalDonors: randInt(15, 110),
                peakListeners: randInt(25, 120),
                topDonors: [],
                lastLiveAt: daysAgo(1),
                lastOfflineAt: daysAgo(1),
            },
            sessions: [],
        };
    }));
    const roomDocs = await Room.insertMany(roomBlueprints);
    const seededCovers = roomBlueprints.filter(r => r.coverImageUrl).length;
    console.log(`✓ Inserted ${roomDocs.length} live rooms (${seededCovers} with uploaded covers)`);

    // ── Listener docs (active sockets) ───────────────────────────────────────
    // Each user can only physically be in ONE room at a time, so we assign
    // each listener to a single room (round-robin). Otherwise the Friends
    // Activity sidebar shows the same person in multiple rooms simultaneously.
    const allListeners = [...listenerDocs, ...(devUser ? [devUser] : [])];
    const listenerRows = [];
    const shuffledListeners = pick(allListeners, allListeners.length); // shuffle copy
    shuffledListeners.forEach((u, i) => {
        const room = roomDocs[i % roomDocs.length];
        listenerRows.push({
            roomId: room._id, userId: u._id, isActive: true,
            joinedAt: minutesAgo(randInt(1, 25)),
            country: 'VN', city: 'Ho Chi Minh',
        });
    });
    await Listener.insertMany(listenerRows);
    console.log(`✓ Inserted ${listenerRows.length} active listener rows (1 per user)`);

    // ── Friendships (all-pairs accepted between listeners ↔ creators) ────────
    // Listener → creator only; avoids direction collisions in the unique index.
    const friendDocs = [];
    for (const l of listenerDocs) {
        for (const c of creatorDocs) {
            friendDocs.push({ requester: l._id, recipient: c._id, status: 'accepted' });
        }
        // listener-to-listener (just one ring)
        const next = listenerDocs[(listenerDocs.indexOf(l) + 1) % listenerDocs.length];
        if (next._id.toString() !== l._id.toString()) {
            friendDocs.push({ requester: l._id, recipient: next._id, status: 'accepted' });
        }
        if (devUser) friendDocs.push({ requester: l._id, recipient: devUser._id, status: 'accepted' });
    }
    await Friendship.insertMany(friendDocs, { ordered: false }).catch(() => { /* tolerate dup-key on re-run */ });
    console.log(`✓ Inserted friendships (${friendDocs.length} edges)`);

    // ── Room favorites — listeners + dev star a couple of rooms ──────────────
    const favRows = [];
    for (const u of allListeners) {
        const stars = pick(roomDocs, randInt(2, 3));
        stars.forEach(r => favRows.push({ userId: u._id, roomId: r._id }));
    }
    await RoomFavorite.insertMany(favRows, { ordered: false }).catch(() => { });
    console.log(`✓ Inserted ${favRows.length} room favorites`);

    // ── Song reactions (likes only, scattered) ───────────────────────────────
    const reactionRows = [];
    for (const u of allListeners) {
        const liked = pick(songs, randInt(4, 8));
        liked.forEach(s => {
            const room = roomDocs.find(r => r.playlist.some(id => id.toString() === s._id.toString())) ?? roomDocs[0];
            reactionRows.push({ userId: u._id, songId: s._id, roomId: room._id, reaction: 'like' });
        });
    }
    await SongReaction.insertMany(reactionRows, { ordered: false }).catch(() => { });
    console.log(`✓ Inserted ${reactionRows.length} song reactions`);

    // ── Donation transactions + topDonors ────────────────────────────────────
    // Every listener donates to 2-3 random rooms. Aggregates feed
    // streamGoalCurrent and the per-room topDonors list.
    const txRows = [];
    const donationsByRoom = new Map();
    for (const u of allListeners) {
        const targets = pick(roomDocs, randInt(2, 3));
        for (const r of targets) {
            const amount = randInt(50, 600);
            txRows.push({
                userId: u._id, type: 'donation', amount, currency: 'coins', status: 'completed',
                roomId: r._id, donorName: u.fullName, createdAt: minutesAgo(randInt(5, 240)),
            });
            const list = donationsByRoom.get(r._id.toString()) ?? [];
            list.push({ name: u.fullName, totalCoins: amount });
            donationsByRoom.set(r._id.toString(), list);
        }
        // Plus a top-up so wallet history isn't empty
        txRows.push({
            userId: u._id, type: 'topup', amount: 1100, currency: 'coins', status: 'completed',
            stripeSessionId: `cs_demo_${u._id}_${Date.now()}`, createdAt: daysAgo(randInt(1, 14)),
        });
    }
    await Transaction.insertMany(txRows, { ordered: false }).catch(() => { });
    console.log(`✓ Inserted ${txRows.length} transactions`);

    // Patch room topDonors (top 5 by donation amount)
    for (const room of roomDocs) {
        const donations = donationsByRoom.get(room._id.toString()) ?? [];
        const top5 = donations
            .sort((a, b) => b.totalCoins - a.totalCoins)
            .slice(0, 5);
        const totalDonationCoins = donations.reduce((sum, d) => sum + d.totalCoins, 0);
        await Room.updateOne(
            { _id: room._id },
            { $set: { 'stats.topDonors': top5, streamGoalCurrent: Math.min(totalDonationCoins, 1000) } },
        );
    }
    console.log('✓ Patched room topDonors + stream goal current');

    // ── Top-up + plan catalog ────────────────────────────────────────────────
    const packages = await TopupPackage.insertMany(TOPUP_PACKAGES);
    const plans = await SubscriptionPlan.insertMany(SUBSCRIPTION_PLANS);
    console.log(`✓ Inserted ${packages.length} top-up packages, ${plans.length} plans`);

    // ── Synthetic analytics: 30 days of SongDailyStat + SongPlay + ListenEvent
    // Why: admin "Songs" charts (Top streamed, Skip rate, Trend, Streams by
    // country, Top artists) all read from rollups. Without fresh rows tied to
    // the just-inserted song/user IDs, every bar renders "Unknown title".
    // Strategy: generate one SongDailyStat per (song, day) for the last 30
    // days, plus a sparse set of SongPlay docs with backing ListenEvents so
    // the time-series + country charts have real data to plot.
    const COUNTRIES = ['VN', 'US', 'KH', 'JP', 'KR'];
    const STAT_DAYS = 30;
    const dailyStats = [];
    const songPlays = [];
    const listenEvents = [];

    for (const song of songs) {
        // 30-day daily rollup with a smooth synthetic curve so charts don't
        // look uniform random.
        const base = randInt(8, 60); // baseline streams per day for this song
        for (let d = 0; d < STAT_DAYS; d++) {
            const date = new Date(Date.now() - d * 86_400_000);
            const dateStr = date.toISOString().slice(0, 10);
            // Vary daily volume with a sine-ish wobble + day-of-week effect
            const wobble = Math.round(base * (0.6 + Math.random() * 0.8));
            const streams = wobble;
            const plays = Math.round(streams * (1 + Math.random() * 0.4));
            const skips = Math.round(plays * (Math.random() * 0.15));
            const listeners = Math.round(streams * 0.8);
            // Top countries roughly weighted toward VN (host country)
            const c1 = COUNTRIES[0];
            const c2 = COUNTRIES[randInt(1, COUNTRIES.length - 1)];
            dailyStats.push({
                songId: song._id,
                date: dateStr,
                streams, plays, skips, listeners,
                topCountries: [
                    { country: c1, streams: Math.round(streams * 0.7) },
                    { country: c2, streams: Math.round(streams * 0.3) },
                ],
                peakHour: randInt(18, 23),
                avgListenMs: randInt(45_000, 180_000),
            });
        }

        // 8-15 SongPlay docs across 30 days for trend chart granularity
        const playCount = randInt(8, 15);
        for (let i = 0; i < playCount; i++) {
            const startedAt = new Date(Date.now() - randInt(0, STAT_DAYS) * 86_400_000 - randInt(0, 86_400_000));
            const totalDurationMs = song.duration * 1000;
            const endedAt = new Date(startedAt.getTime() + totalDurationMs);
            const wasSkipped = Math.random() < 0.12;
            const presentCount = randInt(3, 18);
            const streamListeners = wasSkipped ? Math.round(presentCount * 0.3) : Math.round(presentCount * 0.85);
            const room = roomDocs.find(r => r.playlist.some(id => id.toString() === song._id.toString())) ?? roomDocs[0];
            const songPlayId = new mongoose.Types.ObjectId();
            songPlays.push({
                _id: songPlayId,
                songId: song._id, roomId: room._id,
                startedAt, endedAt, totalDurationMs,
                wasSkipped, presentCount, streamListeners,
                countedStream: !wasSkipped,
            });

            // 1-3 ListenEvents per play (one per active listener) — denorm
            // fields populated so country chart + user history queries work.
            const evCount = Math.min(allListeners.length, randInt(1, 3));
            const evUsers = pick(allListeners, evCount);
            for (const u of evUsers) {
                const listenedMs = wasSkipped ? randInt(2_000, 25_000) : randInt(40_000, totalDurationMs);
                listenEvents.push({
                    userId: u._id,
                    songPlayId,
                    listenedMs,
                    countedStream: listenedMs >= 30_000,
                    wasSkipped,
                    songId: song._id,
                    artistName: song.artist,
                    songTitle: song.title,
                    hour: startedAt.getUTCHours(),
                    dayOfWeek: startedAt.getUTCDay(),
                    country: COUNTRIES[randInt(0, 2)], // VN-skewed
                    region: null,
                    city: null,
                    playedAt: startedAt,
                });
            }
        }
    }

    // Bulk insert (ordered:false to skip dup-key issues from listenEvent unique compound)
    await SongDailyStat.insertMany(dailyStats, { ordered: false }).catch(() => { });
    await SongPlay.insertMany(songPlays, { ordered: false }).catch(() => { });
    await ListenEvent.insertMany(listenEvents, { ordered: false }).catch(() => { });
    console.log(`✓ Inserted ${dailyStats.length} daily stats, ${songPlays.length} song plays, ${listenEvents.length} listen events`);

    // Refresh Song.streamCount/uniquePlays/skipCount from synthesized rollups
    // so the "fallback" path in admin.controller (Song.find sort by streamCount)
    // also looks plausible if the rollup query ever misses.
    for (const song of songs) {
        const rollups = dailyStats.filter(d => d.songId.toString() === song._id.toString());
        const streamCount = rollups.reduce((s, r) => s + r.streams, 0);
        const uniquePlays = rollups.reduce((s, r) => s + r.plays, 0);
        const skipCount   = rollups.reduce((s, r) => s + r.skips, 0);
        await Song.updateOne({ _id: song._id }, { $set: { streamCount, uniquePlays, skipCount } });
    }
    console.log('✓ Patched song-level streamCount/uniquePlays/skipCount');

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n── Demo seed summary ──────────────────────────────');
    console.log(`  Songs:       ${songs.length}`);
    console.log(`  Creators:    ${creatorDocs.length}`);
    console.log(`  Listeners:   ${listenerDocs.length}${devUser ? ' (+1 dev)' : ''}`);
    console.log(`  Rooms LIVE:  ${roomDocs.length}`);
    roomDocs.forEach(r => console.log(`    • ${r.title} — ${r.playlist.length} songs`));
    console.log('───────────────────────────────────────────────────');

    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
});
