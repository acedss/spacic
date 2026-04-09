export interface Song {
    _id: string;
    title: string;
    artist: string;
    imageUrl: string;
    audioUrl: string; // Presigned S3 URL
    duration: number;
    albumId: string | null;
}

export interface RoomPlayback {
    currentSongIndex: number;
    startTimeUnix: number | null;
    pausedAtMs: number;
    lastSyncAt?: string;
}

export interface CreateRoomPayload {
    title: string;
    description?: string;
    isPublic?: boolean;
    playlistIds: string[];
    streamGoal?: number; // coins; 0 = no donation goal
}

export interface RoomStats {
    totalSessions:        number;
    totalListeners:       number;
    totalMinutesListened: number;
    totalCoinsEarned:     number;
    totalDonors:          number;
    peakListeners:        number;
    topDonors: { name: string; totalCoins: number }[];
    lastLiveAt:    string | null;
    lastOfflineAt: string | null;
}

export interface RoomSession {
    startedAt: string;
    endedAt: string;
    listenerCount: number;
    minutesListened: number;
    coinsEarned: number;
    topDonors: { name: string; totalCoins: number }[];
}

export interface RoomInfo {
    _id: string;
    creatorId: string;
    title: string;
    description?: string;
    status: 'offline' | 'live';
    isPublic: boolean;
    capacity: number;
    voteThresholdPercent: number;
    playlist: Song[];
    playback: RoomPlayback;
    liveAt?: string | null;
    streamGoal: number;
    streamGoalCurrent: number;
    favoriteCount: number;
    stats: RoomStats;
    sessions?: RoomSession[];
    listenerCount?: number;
}

export interface Transaction {
    _id: string;
    type: 'topup' | 'donation' | 'goal_payout';
    amount: number; // credits
    status: 'pending' | 'completed' | 'failed';
    roomId?: { _id: string; title: string } | null;
    donorName?: string | null;
    createdAt: string;
}

export interface TopupPackage {
    id: string;
    label: string;
    priceInCents: number;
    credits: number;
    bonus: string | null;
    isFeatured: boolean;
}

export interface SubscriptionPlan {
    slug: string;
    name: string;
    tier: 'PREMIUM' | 'CREATOR';
    priceMonthlyUsd: number;  // cents
    priceYearlyUsd: number | null;
    features: string[];
    roomCapacity: number;
    canSubscribeMonthly: boolean;
    canSubscribeYearly: boolean;
}

// ── Friends Service (Sprint 4) ────────────────────────────────────────────────

export interface Friend {
    friendshipId: string;
    userId:       string;
    fullName:     string;
    imageUrl:     string;
}

export interface FriendRequest {
    _id:    string; // friendshipId
    status: 'pending' | 'accepted' | 'declined';
    requester: Friend;
    recipient: Friend;
    createdAt: string;
}

export interface FriendSearchResult {
    userId:          string;
    fullName:        string;
    imageUrl:        string;
    username:        string | null;
    friendshipId:    string | null;
    friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

export interface FriendActivityItem {
    userId:   string;
    fullName: string;
    imageUrl: string;
    room?:    { _id: string; title: string };
    joinedAt?: string;
}

export interface FriendActivity {
    listening: FriendActivityItem[];
    online:    FriendActivityItem[];
    offline:   FriendActivityItem[];
}

export interface FriendInvite {
    inviteId:   string;
    inviteCode: string;   // for ?ref= URL tracking and analytics
    from:       { userId: string; fullName: string; imageUrl: string };
    room:       { _id: string; title: string };
    expiresAt:  string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    user: {
        id: string;
        username: string;
        imageUrl?: string;
    };
    message: string;
    sentAt: string;
    isSystem?: boolean;
}
