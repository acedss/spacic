// Service: Room business logic
// Called by: room.controller, socket event handlers

import mongoose from "mongoose";
import { Room } from "../models/room.model.js";
import { Listener } from "../models/listener.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { Transaction } from "../models/transaction.model.js";
import { RoomFavorite } from "../models/roomFavorite.model.js";
import { socketManager } from "../lib/socket-manager.js";
import { getPresignedUrl } from "./s3.services.js";

// ───── Helpers ──────────────────────────────────────────────────────────────

const getCapacityByTier = (tier) => socketManager.getRoomCapacityByTier(tier);

const getUserByClerkId = async (clerkId) => {
    const user = await User.findOne({ clerkId });
    if (!user) throw new Error("User not found");
    return user;
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
    const room = await Room.findById(roomId);
    if (!room || room.status !== "live") return; // already offline or not found

    const offlineAt  = new Date();
    const sessionStart = room.liveAt ?? room.createdAt;

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
