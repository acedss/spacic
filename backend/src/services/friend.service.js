// Service: Friends — social graph, activity, invites
// SPC-55 (requests), SPC-57 (search), SPC-18 (activity), SPC-56 (invite)

import { v4 as uuidv4 } from 'uuid';
import { Friendship } from '../models/friendship.model.js';
import { User }       from '../models/user.model.js';
import { Room }       from '../models/room.model.js';
import { Listener }   from '../models/listener.model.js';
import { InviteLog }  from '../models/inviteLog.model.js';
import { getIo }      from '../lib/io.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getUserByClerkId = async (clerkId) => {
    const user = await User.findOne({ clerkId }).select('_id fullName imageUrl');
    if (!user) throw new Error('User not found');
    return user;
};

// Returns accepted friend userIds for a given userId (both directions)
const getFriendIds = async (userId) => {
    const friendships = await Friendship.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: 'accepted',
    }).select('requester recipient');

    return friendships.map((f) =>
        f.requester.toString() === userId.toString()
            ? f.recipient
            : f.requester
    );
};

// ── SPC-55: Friend Request System ─────────────────────────────────────────────

export const sendRequest = async (clerkId, targetUserId) => {
    const me = await getUserByClerkId(clerkId);

    if (me._id.toString() === targetUserId) {
        throw new Error('Cannot send a friend request to yourself');
    }

    const target = await User.findById(targetUserId).select('_id fullName imageUrl');
    if (!target) throw new Error('User not found');

    // Check all existing relationships in one query
    const existing = await Friendship.findOne({
        $or: [
            { requester: me._id, recipient: targetUserId },
            { requester: targetUserId, recipient: me._id },
        ],
    });

    if (existing) {
        if (existing.status === 'accepted') throw new Error('Already friends');
        if (existing.status === 'pending') {
            if (existing.requester.toString() === me._id.toString()) {
                throw new Error('Friend request already sent');
            }
            throw new Error('This user already sent you a request — accept it instead');
        }
        // declined → allow re-request by updating the existing doc
        existing.status  = 'pending';
        existing.requester = me._id;
        existing.recipient = targetUserId;
        await existing.save();

        getIo()?.to(targetUserId).emit('friend:request_received', {
            friendshipId: existing._id,
            from: { userId: me._id, fullName: me.fullName, imageUrl: me.imageUrl },
        });
        return existing;
    }

    const friendship = await Friendship.create({
        requester: me._id,
        recipient: targetUserId,
    });

    getIo()?.to(targetUserId).emit('friend:request_received', {
        friendshipId: friendship._id,
        from: { userId: me._id, fullName: me.fullName, imageUrl: me.imageUrl },
    });

    return friendship;
};

export const acceptRequest = async (clerkId, friendshipId) => {
    const me         = await getUserByClerkId(clerkId);
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw new Error('Friend request not found');
    if (friendship.recipient.toString() !== me._id.toString()) throw new Error('Unauthorized');
    if (friendship.status !== 'pending') throw new Error('Request is no longer pending');

    friendship.status = 'accepted';
    await friendship.save();

    // Notify requester their request was accepted
    getIo()?.to(friendship.requester.toString()).emit('friend:request_accepted', {
        friendshipId: friendship._id,
        friend: { userId: me._id, fullName: me.fullName, imageUrl: me.imageUrl },
    });

    return friendship;
};

export const declineRequest = async (clerkId, friendshipId) => {
    const me         = await getUserByClerkId(clerkId);
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw new Error('Friend request not found');
    if (friendship.recipient.toString() !== me._id.toString()) throw new Error('Unauthorized');
    if (friendship.status !== 'pending') throw new Error('Request is no longer pending');

    friendship.status = 'declined';
    await friendship.save();
    return friendship;
};

export const unfriend = async (clerkId, friendshipId) => {
    const me         = await getUserByClerkId(clerkId);
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw new Error('Friendship not found');

    const isParty =
        friendship.requester.toString() === me._id.toString() ||
        friendship.recipient.toString() === me._id.toString();
    if (!isParty) throw new Error('Unauthorized');

    await friendship.deleteOne();
};

export const getFriends = async (clerkId) => {
    const me = await getUserByClerkId(clerkId);

    const friendships = await Friendship.find({
        $or: [{ requester: me._id }, { recipient: me._id }],
        status: 'accepted',
    }).select('_id requester recipient').populate('requester recipient', '_id fullName imageUrl');

    return friendships.map((f) => {
        const friend = f.requester._id.toString() === me._id.toString() ? f.recipient : f.requester;
        return {
            friendshipId: f._id,
            userId:       friend._id,
            fullName:     friend.fullName,
            imageUrl:     friend.imageUrl,
        };
    });
};

export const getIncomingRequests = async (clerkId) => {
    const me = await getUserByClerkId(clerkId);
    return Friendship.find({ recipient: me._id, status: 'pending' })
        .populate('requester', '_id fullName imageUrl')
        .sort({ createdAt: -1 });
};

export const getSentRequests = async (clerkId) => {
    const me = await getUserByClerkId(clerkId);
    return Friendship.find({ requester: me._id, status: 'pending' })
        .populate('recipient', '_id fullName imageUrl')
        .sort({ createdAt: -1 });
};

// ── SPC-57: Friends Discovery & Search ────────────────────────────────────────

export const searchUsers = async (clerkId, q, limit = 20, skip = 0) => {
    if (!q || q.trim().length < 1) return [];

    const me = await getUserByClerkId(clerkId);

    // Step 1: find users matching name OR username, exclude self
    const trimmed = q.trim();
    const users = await User.find({
        $or: [
            { fullName: { $regex: trimmed, $options: 'i' } },
            { username: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } },
        ],
        _id: { $ne: me._id },
    })
        .limit(limit)
        .skip(skip)
        .select('_id fullName imageUrl username');

    if (users.length === 0) return [];

    // Step 2: fetch all friendships touching me ↔ any found user in one query
    const foundIds = users.map((u) => u._id);
    const friendships = await Friendship.find({
        $or: [
            { requester: me._id, recipient: { $in: foundIds } },
            { recipient: me._id, requester: { $in: foundIds } },
        ],
    });

    // Build lookup map: otherUserId → friendship doc
    const fMap = new Map();
    for (const f of friendships) {
        const otherId =
            f.requester.toString() === me._id.toString()
                ? f.recipient.toString()
                : f.requester.toString();
        fMap.set(otherId, f);
    }

    // Step 3: enrich each result with friendship status
    return users.map((u) => {
        const f = fMap.get(u._id.toString());
        let friendshipStatus = 'none';
        let friendshipId     = null;

        if (f) {
            friendshipId = f._id;
            if (f.status === 'accepted') {
                friendshipStatus = 'accepted';
            } else if (f.status === 'pending') {
                friendshipStatus =
                    f.requester.toString() === me._id.toString()
                        ? 'pending_sent'
                        : 'pending_received';
            }
            // 'declined' → treat as 'none' for UX
        }

        return {
            userId:          u._id,
            fullName:        u.fullName,
            imageUrl:        u.imageUrl,
            username:        u.username ?? null,
            friendshipId,
            friendshipStatus,
        };
    });
};

// ── SPC-18: Friends Activity Feed ─────────────────────────────────────────────

export const getFriendsActivity = async (clerkId) => {
    const me        = await getUserByClerkId(clerkId);
    const friendIds = await getFriendIds(me._id);

    if (friendIds.length === 0) {
        return { listening: [], online: [], offline: [] };
    }

    // Who's currently in a room?
    const activeListeners = await Listener.find({
        userId:   { $in: friendIds },
        isActive: true,
    })
        .populate('userId',  '_id fullName imageUrl')
        .populate('roomId',  '_id title status');

    const listeningUserIds = new Set(
        activeListeners.map((l) => l.userId._id.toString())
    );

    // Who's online but not in a room? (check Socket.IO personal rooms)
    const io = getIo();
    const notListening = friendIds.filter(
        (id) => !listeningUserIds.has(id.toString())
    );

    const onlineIds  = [];
    const offlineIds = [];

    for (const id of notListening) {
        const inRoom = io?.sockets.adapter.rooms.has(id.toString());
        if (inRoom) onlineIds.push(id);
        else        offlineIds.push(id);
    }

    // Fetch user data for online + offline groups
    const [onlineUsers, offlineUsers] = await Promise.all([
        User.find({ _id: { $in: onlineIds  } }).select('_id fullName imageUrl'),
        User.find({ _id: { $in: offlineIds } }).select('_id fullName imageUrl'),
    ]);

    return {
        listening: activeListeners.map((l) => ({
            userId:   l.userId._id,
            fullName: l.userId.fullName,
            imageUrl: l.userId.imageUrl,
            room:     { _id: l.roomId._id, title: l.roomId.title },
            joinedAt: l.joinedAt,
        })),
        online:  onlineUsers.map((u) => ({ userId: u._id, fullName: u.fullName, imageUrl: u.imageUrl })),
        offline: offlineUsers.map((u) => ({ userId: u._id, fullName: u.fullName, imageUrl: u.imageUrl })),
    };
};

// ── SPC-56: Direct Group Invite ────────────────────────────────────────────────

export const sendInvite = async (clerkId, friendId, roomId) => {
    const me = await getUserByClerkId(clerkId);

    // Validate friendship
    const friendship = await Friendship.findOne({
        $or: [
            { requester: me._id, recipient: friendId },
            { requester: friendId, recipient: me._id },
        ],
        status: 'accepted',
    });
    if (!friendship) throw new Error('Not friends with this user');

    // Validate room
    const room = await Room.findById(roomId).select('_id title status capacity');
    if (!room)                  throw new Error('Room not found');
    if (room.status !== 'live') throw new Error('Room is not live');

    // Check capacity via Redis listener count
    const activeCount = await Listener.countDocuments({ roomId, isActive: true });
    if (activeCount >= room.capacity) throw new Error('Room is full');

    // Check friend not already in room
    const alreadyIn = await Listener.findOne({ roomId, userId: friendId, isActive: true });
    if (alreadyIn) throw new Error('Friend is already in this room');

    const io = getIo();
    if (!io) throw new Error('Socket server unavailable');

    const expiresAt = new Date(Date.now() + 60_000); // 60s TTL

    io.to(friendId.toString()).emit('friend:invite', {
        inviteId:  uuidv4(),
        from:      { userId: me._id, fullName: me.fullName, imageUrl: me.imageUrl },
        room:      { _id: room._id, title: room.title },
        expiresAt: expiresAt.toISOString(),
    });

    // Log the invite action for analytics (fire-and-forget)
    InviteLog.updateOne(
        { referrerId: me._id, joinerId: friendId, roomId: room._id, type: 'invite_sent' },
        { $setOnInsert: { referrerId: me._id, joinerId: friendId, roomId: room._id, type: 'invite_sent' } },
        { upsert: true }
    ).catch(() => {});
};
