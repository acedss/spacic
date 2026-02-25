// In-memory state manager for Socket.io
// Tracks ephemeral data: user sessions, room sessions, online users

class SocketManager {
    constructor() {
        // Map<socketId, { userId, clerkId, userName, userImage, userTier, currentRoomId, joinedAt }>
        this.userSessions = new Map();

        // Map<roomId, { creatorId, title, capacity, isLive, currentSongId, currentSongPresignedUrl, listeners: Set<userId>, listenerCount, createdAt, currentPlaybackTime }>
        this.roomSessions = new Map();

        // Map<userId, { socketId, currentRoomId, userTier, joinedAt }>
        this.onlineUsers = new Map();
    }

    // ===== User Session Management =====
    addUserSession(socketId, userData) {
        const userSession = {
            userId: userData.userId,
            clerkId: userData.clerkId,
            userName: userData.userName,
            userImage: userData.userImage,
            userTier: userData.userTier,
            currentRoomId: null,
            joinedAt: new Date(),
        };
        this.userSessions.set(socketId, userSession);
        this.onlineUsers.set(userData.userId, {
            socketId,
            currentRoomId: null,
            userTier: userData.userTier,
            joinedAt: new Date(),
        });
    }

    removeUserSession(socketId) {
        const userSession = this.userSessions.get(socketId);
        if (userSession) {
            this.onlineUsers.delete(userSession.userId);
            this.userSessions.delete(socketId);
        }
    }

    getUserBySocketId(socketId) {
        return this.userSessions.get(socketId);
    }

    getUserById(userId) {
        return this.onlineUsers.get(userId);
    }

    getAllOnlineUsers() {
        return Array.from(this.userSessions.values());
    }

    getOnlineUsersByTier(tier) {
        return Array.from(this.userSessions.values()).filter(u => u.userTier === tier);
    }

    // ===== Room Session Management =====
    addRoomSession(roomId, roomData) {
        const roomSession = {
            creatorId: roomData.creatorId,
            title: roomData.title,
            capacity: roomData.capacity,
            currentSongId: null,
            currentSongPresignedUrl: null,
            currentPlaybackTime: 0,
            isPlaying: false,
            listeners: new Set(),
            listenerCount: 0,
            createdAt: new Date(),
            ...roomData,
        };
        this.roomSessions.set(roomId, roomSession);
        return roomSession;
    }

    removeRoomSession(roomId) {
        this.roomSessions.delete(roomId);
    }

    getRoomById(roomId) {
        return this.roomSessions.get(roomId);
    }

    getAllActiveRooms() {
        return Array.from(this.roomSessions.values());
    }

    // ===== User-Room Relationship =====
    updateUserCurrentRoom(socketId, roomId) {
        const userSession = this.userSessions.get(socketId);
        if (userSession) {
            userSession.currentRoomId = roomId;
            const onlineUser = this.onlineUsers.get(userSession.userId);
            if (onlineUser) {
                onlineUser.currentRoomId = roomId;
            }
        }
    }

    // ===== Room Listeners Management =====
    addRoomListener(roomId, userId) {
        const room = this.roomSessions.get(roomId);
        if (room && !room.listeners.has(userId)) {
            room.listeners.add(userId);
            room.listenerCount = room.listeners.size;
            return true;
        }
        return false;
    }

    removeRoomListener(roomId, userId) {
        const room = this.roomSessions.get(roomId);
        if (room && room.listeners.has(userId)) {
            room.listeners.delete(userId);
            room.listenerCount = room.listeners.size;
            return true;
        }
        return false;
    }

    getUsersInRoom(roomId) {
        const room = this.roomSessions.get(roomId);
        if (room) {
            return Array.from(room.listeners);
        }
        return [];
    }

    // ===== Playback State =====
    updateRoomPlaybackState(roomId, { currentSongId, currentSongPresignedUrl, isPlaying, currentPlaybackTime }) {
        const room = this.roomSessions.get(roomId);
        if (room) {
            if (currentSongId !== undefined) room.currentSongId = currentSongId;
            if (currentSongPresignedUrl !== undefined) room.currentSongPresignedUrl = currentSongPresignedUrl;
            if (isPlaying !== undefined) room.isPlaying = isPlaying;
            if (currentPlaybackTime !== undefined) room.currentPlaybackTime = currentPlaybackTime;
        }
    }

    getRoomPlaybackState(roomId) {
        const room = this.roomSessions.get(roomId);
        if (room) {
            return {
                currentSongId: room.currentSongId,
                currentSongPresignedUrl: room.currentSongPresignedUrl,
                isPlaying: room.isPlaying,
                currentPlaybackTime: room.currentPlaybackTime,
            };
        }
        return null;
    }

    // ===== Utility =====
    getRoomCapacityByTier(tier) {
        switch (tier) {
            case "FREE":
                return 10;
            case "PREMIUM":
                return 50;
            case "CREATOR":
                return Infinity;
            default:
                return 10;
        }
    }

    isRoomAtCapacity(roomId) {
        const room = this.roomSessions.get(roomId);
        if (room) {
            return room.listenerCount >= room.capacity;
        }
        return false;
    }
}

export const socketManager = new SocketManager();
