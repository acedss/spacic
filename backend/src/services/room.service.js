// Service: Room business logic
// Called by: room.controller, socket event handlers
// Follows the 6-layer Request Lifecycle pattern

import { Room } from "../models/room.model.js";
import { Listener } from "../models/listener.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { socketManager } from "../lib/socket-manager.js";
import { getPresignedUrl } from "./s3.services.js";

// ───── Helpers ──────────────────────────────────────────────────────────────

const getCapacityByTier = (tier) => socketManager.getRoomCapacityByTier(tier);

const getUserByClerkId = async (clerkId) => {
    const user = await User.findOne({ clerkId });
    if (!user) throw new Error("User not found");
    return user;
};

// ───── Create Room ───────────────────────────────────────────────────────────

export const createRoom = async (clerkId, { title, description, isPublic = true, voteThresholdPercent = 50, playlistIds = [] }) => {
    const user = await getUserByClerkId(clerkId);
    const capacity = getCapacityByTier(user.userTier);

    // Persist to MongoDB first — the _id anchors the Redis key
    const startTimeUnix = Date.now();
    const room = await Room.create({
        creatorId: user._id,
        title,
        description,
        isPublic,
        voteThresholdPercent,
        capacity,
        playlist: playlistIds,
        status: "active",
        playback: { currentSongIndex: 0, startTimeUnix, pausedAtMs: 0 },
    });

    // Generate presigned URL for the first song so creator can play immediately
    let firstSong = null;
    let presignedUrl = null;
    if (playlistIds.length > 0) {
        firstSong = await Song.findById(playlistIds[0]);
        if (firstSong) presignedUrl = await getPresignedUrl(firstSong.s3Key);
    }

    // Initialise Redis session with full playback state
    await socketManager.addRoomSession(room._id.toString(), {
        creatorId: user._id.toString(),
        title: room.title,
        capacity,
        currentSongId: firstSong?._id.toString() ?? null,
        currentSongPresignedUrl: presignedUrl,
        startTimeUnix,
        pausedAtMs: 0,
        isPlaying: true,
    });

    return {
        ...room.toObject(),
        playback: { startTimeUnix, currentSongIndex: 0, pausedAtMs: 0 },
    };
};

// ───── List Public Rooms ─────────────────────────────────────────────────────

export const getPublicRooms = async ({ sort = "listener_count", limit = 50, offset = 0, search = "" }) => {
    const query = { status: "active", isPublic: true };
    if (search) query.title = { $regex: search, $options: "i" };

    const rooms = await Room.find(query)
        .populate("creatorId", "fullName imageUrl")
        .populate({ path: "playlist", select: "title artist imageUrl duration", options: { limit: 1 } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 100));

    // Merge real-time listener counts from Redis
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

// ───── Get Room By ID ────────────────────────────────────────────────────────

export const getRoomById = async (roomId) => {
    const room = await Room.findById(roomId)
        .populate("creatorId", "fullName imageUrl clerkId")
        .populate("playlist");

    if (!room) throw new Error("Room not found");
    if (room.status === "closed") throw new Error("Room is closed");

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

// ───── Join Room ──────────────────────────────────────────────────────────────

export const joinRoom = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);

    const room = await Room.findById(roomId).populate("playlist");
    if (!room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("Room is not active");

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

// ───── Leave Room ────────────────────────────────────────────────────────────

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

// ───── Close Room (Creator only) ─────────────────────────────────────────────

export const closeRoom = async (roomId, clerkId) => {
    const user = await getUserByClerkId(clerkId);
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    if (room.creatorId.toString() !== user._id.toString()) throw new Error("Only the creator can close this room");

    await Room.findByIdAndUpdate(roomId, {
        status: "closed",
        "lifecycle.closedAt": new Date(),
    });

    await Listener.updateMany({ roomId, isActive: true }, { isActive: false, leftAt: new Date() });
    await socketManager.removeRoomSession(roomId);

    return { success: true };
};

// ───── Skip Song (Creator only) ──────────────────────────────────────────────

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
        "playback.currentPlaybackTimeMs": 0,
        "playback.lastSyncAt": new Date(),
    });

    await socketManager.updateRoomPlaybackState(roomId, {
        currentSongId: nextSong._id.toString(),
        startTimeUnix: Date.now(),
        pausedAtMs: 0,
        isPlaying: true,
    });

    return { nextSong, songIndex: nextIndex };
};

// ───── Add Song to Queue (Creator only) ──────────────────────────────────────

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

// ───── Chat ──────────────────────────────────────────────────────────────────

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
