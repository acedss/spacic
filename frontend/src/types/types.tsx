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
}

export interface RoomLifecycle {
    disconnectedAt?: string;
    closingAt?: string;
    closedAt?: string;
}

export interface RoomInfo {
    _id: string;
    creatorId: string;
    title: string;
    status: 'active' | 'closing' | 'closed';
    isPublic: boolean;
    capacity: number;
    voteThresholdPercent: number;
    playlist: Song[];
    playback: RoomPlayback;
    lifecycle: RoomLifecycle;
}

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
