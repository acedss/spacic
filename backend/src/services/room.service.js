// Service: Room business logic
// Called by: room.controller, socket event handlers

import mongoose from "mongoose";
import { Room } from "../models/room.model.js";
import { Listener } from "../models/listener.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { Transaction } from "../models/transaction.model.js";
import { RoomFavorite } from "../models/roomFavorite.model.js";
import { InviteLog } from "../models/inviteLog.model.js";
import { SongPlay } from "../models/songPlay.model.js";
import { ListenEvent } from "../models/listenEvent.model.js";
import { redis } from "../lib/redis.js";
import { socketManager } from "../lib/socket-manager.js";
import { getIo } from "../lib/io.js";
import { getPresignedUrl } from "./s3.services.js";

// ── Song Transition Analytics ─────────────────────────────────────────────────
// Called fire-and-forget from socket.js on room:skip and room:song_ended.
// Writes one SongPlay (room aggregate) + N ListenEvents (per user).
// Never throws — errors are logged and swallowed so playback is unaffected.

export const recordSongTransition = async (roomId, song, startTimeUnix, wasSkipped) => {
    if (!startTimeUnix || !song?._id) return;

    const songEndMs      = Date.now();
    const totalDurationMs = songEndMs - startTimeUnix;

    // Skip songs that barely played (rapid double-skip, room just opened)
    if (totalDurationMs < 1000) return;

    try {
        // All listeners who were in the room at any point during this song
        const listeners = await Listener.find({
            roomId:   new mongoose.Types.ObjectId(roomId),
            joinedAt: { $lte: new Date(songEndMs) },
            $or: [
                { isActive: true },
                { leftAt: { $gte: new Date(startTimeUnix) } }, // left AFTER song started
            ],
        }).lean();

        // Compute per-listener window, grouped by userId.
        // A reconnect produces two Listener docs for the same user — sum their
        // windows before applying the 30s threshold to avoid under-counting.
        const windowsByUser = new Map(); // userId.toString() → { listener, listenedMs }
        for (const l of listeners) {
            const uid            = l.userId.toString();
            const effectiveStart = Math.max(startTimeUnix, l.joinedAt.getTime());
            const effectiveEnd   = l.isActive
                ? songEndMs
                : Math.min(songEndMs, l.leftAt.getTime());
            const ms             = Math.max(0, effectiveEnd - effectiveStart);
            const existing       = windowsByUser.get(uid);
            windowsByUser.set(uid, {
                listener:   existing?.listener ?? l,           // keep first doc for geo
                listenedMs: (existing?.listenedMs ?? 0) + ms, // sum reconnect sessions
            });
        }

        const windows = [...windowsByUser.values()].map(w => ({
            ...w, countedStream: w.listenedMs >= 30_000,
        }));

        const streamListeners = windows.filter(w => w.countedStream).length;
        const startDate       = new Date(startTimeUnix);

        // 1. Write SongPlay (room-level aggregate, owns the time window)
        const songPlay = await SongPlay.create({
            songId:   song._id,
            roomId:   new mongoose.Types.ObjectId(roomId),
            startedAt: startDate,
            endedAt:   new Date(songEndMs),
            totalDurationMs,
            wasSkipped,
            presentCount:    listeners.length,
            streamListeners,
            countedStream:   streamListeners > 0,
        });

        // Pre-compute time fields once (shared across all ListenEvents for this play)
        const hour      = startDate.getHours();
        const dayOfWeek = startDate.getDay();

        // 2. Build ListenEvent docs — lean, only listenedMs delta, no timestamp duplication
        // playedAt copied from startDate so TTL index and time-range queries work
        const events = windows.map(({ listener, listenedMs, countedStream }) => ({
            userId:        listener.userId,
            songPlayId:    songPlay._id,
            listenedMs,
            countedStream,
            wasSkipped,
            songId:        song._id,
            artistName:    song.artist,
            songTitle:     song.title,
            hour,
            dayOfWeek,
            country:       listener.country ?? null,
            region:        listener.region  ?? null,
            city:          listener.city    ?? null,
            playedAt:      startDate,
        }));

        // 3. Redis real-time leaderboard — ZINCRBY trending:songs:daily <streams> <songId>
        // Keyed by UTC date so it resets automatically each day. Expire after 2 days for cleanup.
        const todayKey = `trending:songs:${new Date().toISOString().slice(0, 10)}`;

        // 4. Bulk insert ListenEvents + increment Song counters + update Redis (parallel)
        await Promise.all([
            events.length > 0
                ? ListenEvent.insertMany(events, { ordered: false })
                : Promise.resolve(),
            Song.findByIdAndUpdate(song._id, {
                $inc: {
                    streamCount: streamListeners,
                    uniquePlays: 1,
                    skipCount:   wasSkipped ? 1 : 0,
                },
            }),
            streamListeners > 0
                ? redis.zincrby(todayKey, streamListeners, song._id.toString())
                    .then(() => redis.expire(todayKey, 172_800)) // 2-day expiry
                : Promise.resolve(),
        ]);
    } catch (err) {
        console.error('[recordSongTransition] error:', err.message);
    }
};

// ── Referral tracking ─────────────────────────────────────────────────────────
// Called when a user joins a room via a shared link (/rooms/:id?ref=referrerId).
// Upsert so duplicate clicks don't create duplicate entries.
// Called internally with MongoDB ObjectIds
export const trackReferral = async (referrerId, joinerId, roomId, type = 'link') => {
    if (!referrerId || !joinerId || referrerId.toString() === joinerId.toString()) return;
    await InviteLog.updateOne(
        { referrerId, joinerId, roomId, type },
        { $setOnInsert: { referrerId, joinerId, roomId, type } },
        { upsert: true }
    ).catch(() => {}); // fire-and-forget
};

// Called from controller with clerkIds — resolves to ObjectIds first
export const trackReferralByClerkIds = async (joinerClerkId, referrerClerkId, roomId, type = 'link') => {
    if (!referrerClerkId) return;
    const [joiner, referrer] = await Promise.all([
        User.findOne({ clerkId: joinerClerkId }).select('_id'),
        User.findOne({ clerkId: referrerClerkId }).select('_id'),
    ]);
    if (!joiner || !referrer) return;
    await trackReferral(referrer._id, joiner._id, roomId, type);
};

// ───── Helpers ──────────────────────────────────────────────────────────────

const getCapacityByTier = (tier) => socketManager.getRoomCapacityByTier(tier);

const getUserByClerkId = async (clerkId) => {
    const user = await User.findOne({ clerkId });
    if (!user) throw new Error("User not found");
    return user;
};

// ───── Update Queue While Live ───────────────────────────────────────────────
// Allows creator to add/remove songs and adjust stream goal without going offline.
// Does NOT allow changing title, description, or visibility — those disrupt UX.
// Also re-caches the playlist in Redis so socket.js getNextSong picks it up immediately.

export const updateQueueWhileLive = async (clerkId, roomId, { playlistIds, streamGoal }) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId).select('creatorId status playlist');
    if (!room) throw new Error('Room not found');
    if (room.creatorId.toString() !== user._id.toString()) throw new Error('Only the creator can update the queue');
    if (room.status !== 'live') throw new Error('Room is not live');
    if (!playlistIds || playlistIds.length === 0) throw new Error('Playlist must have at least one song');

    // Fetch full song docs for the new playlist (needed for Redis cache)
    const songs = await Song.find({ _id: { $in: playlistIds } }).select('_id title artist duration imageUrl s3Key albumId').lean();
    // Preserve the order the creator specified
    const ordered = playlistIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);

    const update = { playlist: playlistIds };
    if (streamGoal !== undefined) update.streamGoal = Math.max(0, Math.floor(streamGoal));

    await Room.findByIdAndUpdate(roomId, update);

    const mappedPlaylist = ordered.map(s => ({
        _id: s._id.toString(),
        title: s.title,
        artist: s.artist,
        duration: s.duration,
        imageUrl: s.imageUrl ?? '',
        s3Key: s.s3Key,
        albumId: s.albumId?.toString() ?? null,
    }));

    // Re-cache in Redis so getNextSong picks up the new playlist immediately
    await socketManager.cacheRoomPlaylist(roomId, mappedPlaylist);

    // Notify all clients in the room — frontend RoomStore updates playlist reactively
    const io = getIo();
    if (io) {
        io.to(roomId).emit('room:playlist_updated', { playlist: mappedPlaylist });
    }

    return { success: true };
};

// ───── Upsert Room (create or update creator's permanent channel) ─────────
// One room per creator — creates on first call, updates settings on subsequent calls.

export const upsertRoom = async (clerkId, { title, description, isPublic, voteThresholdPercent, playlistIds, streamGoal }) => {
    const user = await getUserByClerkId(clerkId);
    const capacity = getCapacityByTier(user.userTier);

    const existing = await Room.findOne({ creatorId: user._id });

    if (!existing) {
        const room = await Room.create({
            creatorId: user._id,
            title,
            description:          description ?? "",
            isPublic:             isPublic ?? true,
            voteThresholdPercent: voteThresholdPercent ?? 50,
            capacity,
            playlist:             playlistIds ?? [],
            status:               "offline",
            streamGoal:           Math.max(0, Math.floor(streamGoal ?? 0)),
        });
        return room.toObject();
    }

    // Guard: don't update playlist / capacity while live (would disrupt playback)
    if (existing.status === "live") {
        throw new Error("Cannot update room settings while live. Go offline first.");
    }

    const updates = { capacity }; // always refresh tier-based capacity
    if (title              !== undefined) updates.title              = title;
    if (description        !== undefined) updates.description        = description;
    if (isPublic           !== undefined) updates.isPublic           = isPublic;
    if (voteThresholdPercent !== undefined) updates.voteThresholdPercent = voteThresholdPercent;
    if (playlistIds        !== undefined) updates.playlist           = playlistIds;
    if (streamGoal         !== undefined) updates.streamGoal         = Math.max(0, Math.floor(streamGoal));

    const updated = await Room.findByIdAndUpdate(existing._id, updates, { new: true });
    return updated.toObject();
};

// ───── Get Creator's Own Room ─────────────────────────────────────────────

export const getMyRoom = async (clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findOne({ creatorId: user._id }).populate("playlist");
    if (!room) return null;

    const playlistWithUrls = room.status === "live"
        ? await Promise.all(room.playlist.map(async (song) => ({
            ...song.toObject(),
            audioUrl: await getPresignedUrl(song.s3Key),
        })))
        : room.playlist.map((s) => s.toObject());

    const session = await socketManager.getRoomById(room._id.toString());
    return {
        ...room.toObject(),
        playlist: playlistWithUrls,
        listenerCount: session?.listenerCount ?? 0,
    };
};

// ───── List Public Live Rooms ─────────────────────────────────────────────

export const getPublicRooms = async ({ sort = "listener_count", limit = 50, offset = 0, search = "" }) => {
    const query = { status: "live", isPublic: true };
    if (search) query.title = { $regex: search, $options: "i" };

    const rooms = await Room.find(query)
        .populate("creatorId", "fullName imageUrl")
        .populate({ path: "playlist", select: "title artist imageUrl duration", options: { limit: 1 } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 100));

    const enriched = await Promise.all(rooms.map(async (room) => {
        const session = await socketManager.getRoomById(room._id.toString());
        return {
            ...room.toObject(),
            listenerCount: session?.listenerCount ?? 0,
        };
    }));

    if (sort === "listener_count") {
        enriched.sort((a, b) => b.listenerCount - a.listenerCount);
    }

    const total = await Room.countDocuments(query);
    return { data: enriched, total, limit, offset };
};

// ───── Get Room By ID ────────────────────────────────────────────────────

export const getRoomById = async (roomId) => {
    const room = await Room.findById(roomId)
        .populate("creatorId", "fullName imageUrl clerkId")
        .populate("playlist");

    if (!room) throw new Error("Room not found");

    // Offline rooms are still viewable — show stats, no playback
    if (room.status === "offline") {
        return {
            ...room.toObject(),
            playlist: room.playlist.map((s) => s.toObject()),
            listenerCount: 0,
            currentPlayback: null,
        };
    }

    const playlistWithUrls = await Promise.all(
        room.playlist.map(async (song) => ({
            ...song.toObject(),
            audioUrl: await getPresignedUrl(song.s3Key),
        }))
    );

    const session = await socketManager.getRoomById(roomId);
    const currentPlayback = session ? await socketManager.getRoomPlaybackState(roomId) : null;
    return {
        ...room.toObject(),
        playlist: playlistWithUrls,
        listenerCount: session?.listenerCount ?? 0,
        currentPlayback,
    };
};

// ───── Go Live ───────────────────────────────────────────────────────────

export const goLive = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId).populate("playlist");
    if (!room) throw new Error("Room not found");
    if (room.creatorId.toString() !== user._id.toString()) throw new Error("Only the creator can go live");
    if (room.status === "live") throw new Error("Room is already live");

    const liveAt = new Date();
    const startTimeUnix = liveAt.getTime();

    await Room.findByIdAndUpdate(roomId, {
        status: "live",
        liveAt,
        streamGoalCurrent: 0,
        escrow:            0,
        "playback.currentSongIndex": 0,
        "playback.startTimeUnix":    startTimeUnix,
        "playback.pausedAtMs":       0,
        "playback.lastSyncAt":       liveAt,
    });

    let firstSong    = null;
    let presignedUrl = null;
    if (room.playlist.length > 0) {
        firstSong    = room.playlist[0];
        presignedUrl = await getPresignedUrl(firstSong.s3Key);
    }

    await socketManager.addRoomSession(room._id.toString(), {
        creatorId:               user._id.toString(),
        title:                   room.title,
        capacity:                room.capacity,
        currentSongId:           firstSong?._id.toString()  ?? null,
        currentSongS3Key:        firstSong?.s3Key           ?? null,
        currentSongPresignedUrl: presignedUrl,
        startTimeUnix,
        pausedAtMs: 0,
        isPlaying: true,
    });

    // Notify creator that their room is now live
    const io = getIo();
    if (io) {
        io.to(user._id.toString()).emit('creator:room_live', { roomId: room._id.toString() });

        // Notify all users who have favorited this room (online only — best effort)
        const fans = await RoomFavorite.find({ roomId: room._id }).select('userId').lean();
        for (const fan of fans) {
            const fanId = fan.userId.toString();
            if (fanId === user._id.toString()) continue; // skip creator if they favorited themselves
            io.to(fanId).emit('room:favorite_live', {
                roomId:      room._id.toString(),
                title:       room.title,
                creatorName: user.fullName,
            });
        }
    }

    return {
        ...room.toObject(),
        status: "live",
        liveAt,
        playback: { startTimeUnix, currentSongIndex: 0, pausedAtMs: 0 },
    };
};

// ───── Go Offline (internal — called by socket disconnect timer too) ───────
// Aggregates this session's stats, accumulates into room.stats, pushes session entry.

export const goOfflineInternal = async (roomId) => {
    const room = await Room.findById(roomId).populate("playlist");
    if (!room || room.status !== "live") return; // already offline or not found

    const offlineAt  = new Date();
    const sessionStart = room.liveAt ?? room.createdAt;

    // 0. Record analytics for the currently-playing song (fire-and-forget before listeners are marked left)
    const currentIdx  = room.playback?.currentSongIndex ?? 0;
    const currentSong = room.playlist?.[currentIdx] ?? null;
    const startTimeUnix = room.playback?.startTimeUnix ?? null;
    if (currentSong && startTimeUnix) {
        recordSongTransition(roomId, currentSong, startTimeUnix, false).catch(() => {});
    }

    // 1. Payout any remaining escrow (partial goal) to creator
    if (room.escrow > 0) {
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
            await User.findByIdAndUpdate(room.creatorId, { $inc: { balance: room.escrow } }, { session });
            await Transaction.create([{
                userId: room.creatorId,
                type:   "goal_payout",
                amount: room.escrow,
                status: "completed",
                roomId,
            }], { session });
        });
        session.endSession();
    }

    // 2. Mark all active listeners as left
    await Listener.updateMany({ roomId, isActive: true }, { isActive: false, leftAt: offlineAt });

    // 3. Aggregate listener stats for this session only (since liveAt)
    const listenerAgg = await Listener.aggregate([
        { $match: { roomId: new mongoose.Types.ObjectId(roomId), joinedAt: { $gte: sessionStart } } },
        { $group: {
            _id: null,
            totalListeners:       { $sum: 1 },
            totalMinutesListened: { $sum: {
                $divide: [
                    { $subtract: [{ $ifNull: ["$leftAt", offlineAt] }, "$joinedAt"] },
                    60000,
                ],
            }},
        }},
    ]);
    const listenerStats = listenerAgg[0] ?? { totalListeners: 0, totalMinutesListened: 0 };
    const minutesListened = Math.round(listenerStats.totalMinutesListened);

    // 4. Aggregate donation stats for this session
    const donationAgg = await Transaction.aggregate([
        { $match: {
            roomId: new mongoose.Types.ObjectId(roomId),
            type: "donation",
            status: "completed",
            createdAt: { $gte: sessionStart },
        }},
        { $group: { _id: "$userId", totalCoins: { $sum: "$amount" }, name: { $first: "$donorName" } } },
        { $sort: { totalCoins: -1 } },
    ]);
    const totalDonors   = donationAgg.length;
    const topDonors     = donationAgg.slice(0, 5).map((d) => ({ name: d.name, totalCoins: d.totalCoins }));

    const payoutAgg = await Transaction.aggregate([
        { $match: {
            roomId: new mongoose.Types.ObjectId(roomId),
            type: "goal_payout",
            status: "completed",
            createdAt: { $gte: sessionStart },
        }},
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const coinsEarned = payoutAgg[0]?.total ?? 0;

    // 5. Peak listener count from Redis (before session is removed)
    const roomSession  = await socketManager.getRoomById(roomId);
    const peakListeners = roomSession?.listenerCount ?? listenerStats.totalListeners;

    // 6. Accumulate into room.stats + push session entry
    await Room.findByIdAndUpdate(roomId, {
        status: "offline",
        liveAt: null,
        escrow: 0,
        $inc: {
            "stats.totalSessions":        1,
            "stats.totalListeners":       listenerStats.totalListeners,
            "stats.totalMinutesListened": minutesListened,
            "stats.totalCoinsEarned":     coinsEarned,
            "stats.totalDonors":          totalDonors,
        },
        $max: { "stats.peakListeners": peakListeners },
        $set: {
            "stats.topDonors":    topDonors.map((d) => ({ name: d.name, totalCoins: d.totalCoins })),
            "stats.lastLiveAt":   sessionStart,
            "stats.lastOfflineAt": offlineAt,
        },
        $push: {
            sessions: {
                $each: [{ startedAt: sessionStart, endedAt: offlineAt, listenerCount: listenerStats.totalListeners, minutesListened, coinsEarned, topDonors }],
                $slice: -20, // keep last 20 sessions
            },
        },
    });

    // 7. Accumulate into creator's lifetime stats on User doc
    await User.findByIdAndUpdate(room.creatorId, {
        $inc: {
            "creatorStats.totalRoomsHosted":     1,
            "creatorStats.totalStreams":          listenerStats.totalListeners,
            "creatorStats.totalMinutesListened":  minutesListened,
            "creatorStats.totalCoinsEarned":      coinsEarned,
            "creatorStats.totalUniqueDonors":     totalDonors,
        },
        $set: { "creatorStats.lastLiveAt": offlineAt },
    });

    await socketManager.removeRoomSession(roomId);

    // Notify creator that their room is now offline
    const io = getIo();
    if (io) {
        io.to(room.creatorId.toString()).emit('creator:room_offline');
    }
};

// ───── Go Offline (REST endpoint wrapper — validates creator ownership) ────

export const goOffline = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId).select("creatorId status");
    if (!room) throw new Error("Room not found");
    if (room.creatorId.toString() !== user._id.toString()) throw new Error("Only the creator can go offline");
    if (room.status !== "live") throw new Error("Room is not live");

    await goOfflineInternal(roomId);
    return { success: true };
};

// ───── Join Room ──────────────────────────────────────────────────────────

export const joinRoom = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);

    const room = await Room.findById(roomId).populate("playlist");
    if (!room) throw new Error("Room not found");
    if (room.status !== "live") throw new Error("Room is not live");

    if (await socketManager.isRoomAtCapacity(roomId)) throw new Error("Room is full");

    await Listener.findOneAndUpdate(
        { roomId, userId: user._id },
        { isActive: true, joinedAt: new Date(), leftAt: null },
        { upsert: true, new: true }
    );

    await socketManager.addRoomListener(roomId, user._id.toString());

    const session = await socketManager.getRoomById(roomId);
    const playback = await socketManager.getRoomPlaybackState(roomId);

    return {
        room: room.toObject(),
        playlist: room.playlist,
        playback,
        listenerCount: session?.listenerCount ?? 1,
    };
};

// ───── Leave Room ────────────────────────────────────────────────────────

export const leaveRoom = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);

    await Listener.findOneAndUpdate(
        { roomId, userId: user._id, isActive: true },
        { isActive: false, leftAt: new Date() }
    );

    await socketManager.removeRoomListener(roomId, user._id.toString());

    const session = await socketManager.getRoomById(roomId);
    return { listenerCount: session?.listenerCount ?? 0 };
};

// ───── Skip Song (Creator only) ──────────────────────────────────────────

export const skipSong = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId).populate("playlist");
    if (!room) throw new Error("Room not found");
    if (room.creatorId.toString() !== user._id.toString()) throw new Error("Only the creator can skip songs");

    const nextIndex = room.playback.currentSongIndex + 1;
    if (nextIndex >= room.playlist.length) throw new Error("No more songs in queue");

    const nextSong = room.playlist[nextIndex];

    await Room.findByIdAndUpdate(roomId, {
        "playback.currentSongIndex": nextIndex,
        "playback.startTimeUnix":    Date.now(),
        "playback.pausedAtMs":       0,
        "playback.lastSyncAt":       new Date(),
    });

    await socketManager.updateRoomPlaybackState(roomId, {
        currentSongId: nextSong._id.toString(),
        startTimeUnix: Date.now(),
        pausedAtMs: 0,
        isPlaying: true,
    });

    return { nextSong, songIndex: nextIndex };
};

// ───── Add Song to Queue (Creator only) ──────────────────────────────────

export const addToQueue = async (roomId, clerkId, songId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    if (room.creatorId.toString() !== user._id.toString()) throw new Error("Only the creator can add songs");

    const song = await Song.findById(songId);
    if (!song) throw new Error("Song not found");

    await Room.findByIdAndUpdate(roomId, { $push: { playlist: song._id } });
    return song;
};

// ───── Chat ──────────────────────────────────────────────────────────────

export const sendChatMessage = async (roomId, clerkId, message) => {
    if (!message || message.trim().length === 0) throw new Error("Message cannot be empty");
    if (message.length > 500) throw new Error("Message too long (max 500 characters)");

    const user = await getUserByClerkId(clerkId);

    const listener = await Listener.findOne({ roomId, userId: user._id, isActive: true });
    if (!listener) throw new Error("You must be in the room to chat");

    return {
        id: new Date().toISOString(),
        user: { id: user._id, username: user.fullName, imageUrl: user.imageUrl },
        message: message.trim(),
        sentAt: new Date(),
    };
};

// ───── Get Favorite Rooms ─────────────────────────────────────────────────
// Returns all rooms the user has favorited with live status and listener count.

export const getFavoriteRooms = async (clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const favorites = await RoomFavorite.find({ userId: user._id }).lean();
    if (!favorites.length) return { data: [] };

    const roomIds = favorites.map(f => f.roomId);
    const rooms = await Room.find({ _id: { $in: roomIds } })
        .populate('creatorId', 'fullName imageUrl')
        .populate({ path: 'playlist', select: 'title artist imageUrl duration', options: { limit: 1 } })
        .lean();

    const enriched = await Promise.all(rooms.map(async (room) => {
        const session = room.status === 'live'
            ? await socketManager.getRoomById(room._id.toString())
            : null;
        return {
            ...room,
            listenerCount: session?.listenerCount ?? 0,
            isFavorited: true,
        };
    }));

    // Live rooms first, then alphabetical
    enriched.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return a.title.localeCompare(b.title);
    });

    return { data: enriched };
};

// ───── Get Favorite Status (single room) ─────────────────────────────────

export const getFavoriteStatus = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const existing = await RoomFavorite.findOne({ userId: user._id, roomId }).lean();
    return { favorited: !!existing };
};

// ───── Toggle Favorite ────────────────────────────────────────────────────

export const toggleFavorite = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const existing = await RoomFavorite.findOne({ userId: user._id, roomId });

    if (existing) {
        await RoomFavorite.deleteOne({ _id: existing._id });
        await Room.findByIdAndUpdate(roomId, { $inc: { favoriteCount: -1 } });
        return { favorited: false };
    } else {
        await RoomFavorite.create({ userId: user._id, roomId });
        await Room.findByIdAndUpdate(roomId, { $inc: { favoriteCount: 1 } });
        return { favorited: true };
    }
};

// ───── Get Creator Stats ──────────────────────────────────────────────────
// Returns lifetime stats + last 5 sessions from the creator's permanent room.

export const getCreatorStats = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select("creatorStats fullName imageUrl userTier");
    if (!user) throw new Error("User not found");

    const room = await Room.findOne({ creatorId: user._id })
        .select("title stats sessions favoriteCount status");

    if (!room) {
        return {
            lifetime: {
                totalRoomsHosted: 0, totalStreams: 0, totalMinutesListened: 0,
                totalCoinsEarned: 0, totalUniqueDonors: 0, lastLiveAt: null,
            },
            recentRooms: [],
        };
    }

    const s = room.stats;
    const recentSessions = [...(room.sessions ?? [])].reverse().slice(0, 5);

    return {
        lifetime: {
            totalRoomsHosted:     s.totalSessions,
            totalStreams:         s.totalListeners,
            totalMinutesListened: s.totalMinutesListened,
            totalCoinsEarned:     s.totalCoinsEarned,
            totalUniqueDonors:    s.totalDonors,
            lastLiveAt:           s.lastLiveAt,
        },
        recentRooms: recentSessions.map((sess, i) => ({
            _id:      `session-${i}`,
            title:    room.title,
            closedAt: sess.endedAt,
            stats: {
                totalListeners:       sess.listenerCount,
                totalMinutesListened: sess.minutesListened ?? 0,
                totalCoinsEarned:     sess.coinsEarned,
                favoriteCount:        room.favoriteCount,
                topDonors:            sess.topDonors ?? [],
            },
        })),
    };
};

// ───── Get Creator Room Analytics ───────────────────────────────────────────
// Time-range analytics scoped to creator's own room, used by Creator dashboard.

export const getCreatorRoomAnalytics = async (clerkId, { from, to, granularity } = {}) => {
    const parseDateInput = (value) => {
        if (!value) return null;
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const granularityMap = {
        hourly: "hour",
        daily: "day",
        weekly: "week",
        monthly: "month",
    };
    const granularityInput = String(granularity ?? "daily").toLowerCase();
    const normalizedGranularity = Object.keys(granularityMap).includes(granularityInput)
        ? granularityInput
        : "daily";

    const now = new Date();
    const fallbackFrom = new Date(now.getTime() - 30 * 86_400_000);
    const fromDate = parseDateInput(from) ?? fallbackFrom;
    const toDate = parseDateInput(to) ?? now;
    if (fromDate >= toDate) {
        const error = new Error('Invalid time range: "from" must be before "to"');
        error.statusCode = 400;
        throw error;
    }
    if (toDate.getTime() - fromDate.getTime() > 366 * 86_400_000) {
        const error = new Error("Maximum supported range is 366 days");
        error.statusCode = 400;
        throw error;
    }

    const user = await User.findOne({ clerkId }).select("_id");
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    const room = await Room.findOne({ creatorId: user._id }).select(
        "_id title status favoriteCount streamGoal streamGoalCurrent stats sessions"
    );
    if (!room) {
        return {
            room: null,
            summary: {
                sessions: 0,
                listeners: 0,
                minutesListened: 0,
                coinsEarned: 0,
                peakListeners: 0,
                avgListenersPerSession: 0,
            },
            sessionTrend: [],
            donationTrend: [],
            topSongs: [],
            topSessions: [],
            granularity: normalizedGranularity,
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            days: Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000)),
        };
    }

    const bucketExpr = (field) => {
        if (normalizedGranularity === "weekly") {
            return { $dateTrunc: { date: field, unit: "week", startOfWeek: "monday", timezone: "UTC" } };
        }
        return { $dateTrunc: { date: field, unit: granularityMap[normalizedGranularity], timezone: "UTC" } };
    };
    const bucketIso = {
        $dateToString: { format: "%Y-%m-%dT%H:%M:%SZ", date: "$_id", timezone: "UTC" },
    };

    const roomId = new mongoose.Types.ObjectId(room._id);

    const [sessionTrend, summaryAgg, donationTrend, topSongs, topSessions] = await Promise.all([
        Room.aggregate([
            { $match: { _id: roomId } },
            { $unwind: "$sessions" },
            { $match: { "sessions.startedAt": { $gte: fromDate, $lte: toDate } } },
            {
                $group: {
                    _id: bucketExpr("$sessions.startedAt"),
                    sessions: { $sum: 1 },
                    listeners: { $sum: { $ifNull: ["$sessions.listenerCount", 0] } },
                    minutesListened: { $sum: { $ifNull: ["$sessions.minutesListened", 0] } },
                    coinsEarned: { $sum: { $ifNull: ["$sessions.coinsEarned", 0] } },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: bucketIso, sessions: 1, listeners: 1, minutesListened: 1, coinsEarned: 1 } },
        ]),
        Room.aggregate([
            { $match: { _id: roomId } },
            { $unwind: "$sessions" },
            { $match: { "sessions.startedAt": { $gte: fromDate, $lte: toDate } } },
            {
                $group: {
                    _id: null,
                    sessions: { $sum: 1 },
                    listeners: { $sum: { $ifNull: ["$sessions.listenerCount", 0] } },
                    minutesListened: { $sum: { $ifNull: ["$sessions.minutesListened", 0] } },
                    coinsEarned: { $sum: { $ifNull: ["$sessions.coinsEarned", 0] } },
                    peakListeners: { $max: { $ifNull: ["$sessions.listenerCount", 0] } },
                },
            },
        ]),
        Transaction.aggregate([
            { $match: { roomId, type: "donation", status: "completed", createdAt: { $gte: fromDate, $lte: toDate } } },
            { $group: { _id: bucketExpr("$createdAt"), amount: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: bucketIso, amount: 1, count: 1 } },
        ]),
        SongPlay.aggregate([
            { $match: { roomId, startedAt: { $gte: fromDate, $lte: toDate } } },
            {
                $group: {
                    _id: "$songId",
                    plays: { $sum: 1 },
                    streams: { $sum: { $ifNull: ["$streamListeners", 0] } },
                    skips: { $sum: { $cond: ["$wasSkipped", 1, 0] } },
                },
            },
            { $sort: { streams: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "songs",
                    localField: "_id",
                    foreignField: "_id",
                    as: "song",
                },
            },
            { $unwind: { path: "$song", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    songId: "$_id",
                    title: { $ifNull: ["$song.title", "Unknown title"] },
                    artist: { $ifNull: ["$song.artist", "Unknown artist"] },
                    plays: 1,
                    streams: 1,
                    skips: 1,
                    skipRate: {
                        $cond: [{ $gt: ["$plays", 0] }, { $round: [{ $multiply: [{ $divide: ["$skips", "$plays"] }, 100] }, 0] }, 0],
                    },
                },
            },
        ]),
        Room.aggregate([
            { $match: { _id: roomId } },
            { $unwind: "$sessions" },
            { $match: { "sessions.startedAt": { $gte: fromDate, $lte: toDate } } },
            { $sort: { "sessions.listenerCount": -1, "sessions.coinsEarned": -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 0,
                    startedAt: "$sessions.startedAt",
                    endedAt: "$sessions.endedAt",
                    listenerCount: { $ifNull: ["$sessions.listenerCount", 0] },
                    minutesListened: { $ifNull: ["$sessions.minutesListened", 0] },
                    coinsEarned: { $ifNull: ["$sessions.coinsEarned", 0] },
                },
            },
        ]),
    ]);

    const summary = summaryAgg[0] ?? {
        sessions: 0,
        listeners: 0,
        minutesListened: 0,
        coinsEarned: 0,
        peakListeners: 0,
    };
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));

    return {
        room: {
            _id: room._id,
            title: room.title,
            status: room.status,
            favoriteCount: room.favoriteCount,
            streamGoal: room.streamGoal,
            streamGoalCurrent: room.streamGoalCurrent,
            lifetime: {
                totalSessions: room.stats?.totalSessions ?? 0,
                totalListeners: room.stats?.totalListeners ?? 0,
                totalMinutesListened: room.stats?.totalMinutesListened ?? 0,
                totalCoinsEarned: room.stats?.totalCoinsEarned ?? 0,
                totalDonors: room.stats?.totalDonors ?? 0,
                peakListeners: room.stats?.peakListeners ?? 0,
            },
        },
        summary: {
            sessions: summary.sessions,
            listeners: summary.listeners,
            minutesListened: summary.minutesListened,
            coinsEarned: summary.coinsEarned,
            peakListeners: summary.peakListeners,
            avgListenersPerSession: summary.sessions > 0 ? Number((summary.listeners / summary.sessions).toFixed(1)) : 0,
        },
        sessionTrend,
        donationTrend,
        topSongs,
        topSessions,
        granularity: normalizedGranularity,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days,
    };
};
