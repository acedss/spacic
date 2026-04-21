import { create } from 'zustand';
import type { RoomInfo, ChatMessage, ActiveGame, RoomFeatureFlags } from '@/types/types';

interface CreatorAudio {
    state:    'idle' | 'receiving' | 'done';
    chunks:   string[];
    mimeType: string;
}

export interface Nomination {
    songId: string;
    title:  string;
    artist: string;
    nominatorId:   string;
    nominatorName: string;
    votes: number;
}

export interface EmojiBurst {
    id:       string;
    userId:   string;
    userName: string;
    emoji:    string;
}

export interface TipRainSession {
    userId:   string;
    userName: string;
    imageUrl: string;
    amount:   number;
    x:        number; // vw %
    y:        number; // vh %
}

export interface SessionInfo {
    maxSessionMinutes: number | null;
    liveAt:            string | null;
    voteThresholdPercent: number;
}

interface RoomStore {
    room:                       RoomInfo | null;
    chatMessages:               ChatMessage[];
    listenerCount:              number;
    isCreator:                  boolean;
    creatorDisconnectCountdown: number | null;
    creatorAway:                boolean; // true while creator is disconnected but room still alive
    loading:                    boolean;
    error:                      string | null;

    // Creator mic audio relay
    creatorAudio: CreatorAudio;

    // Broadcast asset playback (pre-recorded/uploaded, played via presigned URL)
    broadcastAsset: { url: string; label: string; durationSeconds: number | null } | null;

    // Active minigame visible to all room members
    activeGame:      ActiveGame | null;
    gameSecondsLeft: number;

    // Voting & reactions
    skipVotes:   { count: number; needed: number };
    reactions:   { likes: number; dislikes: number };
    nominations: Nomination[];
    emojiBursts:     EmojiBurst[];
    tipRainSessions: Record<string, TipRainSession>;
    sessionInfo:     SessionInfo | null;

    // Creator pinned message
    pinnedMessage: { id: string; userId: string; userName: string; message: string; pinnedAt: string } | null;

    setRoom:                      (room: RoomInfo) => void;
    setIsCreator:                 (isCreator: boolean) => void;
    setListenerCount:             (count: number) => void;
    updatePlaylistSongUrl:        (index: number, audioUrl: string) => void;
    addChatMessage:               (msg: ChatMessage) => void;
    setCreatorDisconnectCountdown:(seconds: number | null) => void;
    setCreatorAway:               (away: boolean) => void;
    setLoading:                   (loading: boolean) => void;
    setError:                     (error: string | null) => void;
    reset:                        () => void;

    // Creator audio actions
    setCreatorAudioReceiving: () => void;
    addCreatorAudioChunk:     (chunk: string, mimeType?: string) => void;
    setCreatorAudioDone:      () => void;
    clearCreatorAudio:        () => void;

    // Broadcast asset actions
    setBroadcastAsset:   (asset: { url: string; label: string; durationSeconds: number | null }) => void;
    clearBroadcastAsset: () => void;

    // Feature flag live updates
    updateFeatureFlags: (flags: Partial<RoomFeatureFlags>) => void;

    // Minigame actions
    setActiveGame:      (game: ActiveGame | null) => void;
    setGameSecondsLeft: (secs: number) => void;

    // Voting & reactions actions
    setSkipVotes:    (votes: { count: number; needed: number }) => void;
    setReactions:    (r: { likes: number; dislikes: number }) => void;
    setNominations:  (n: Nomination[]) => void;
    addEmojiBurst:    (burst: EmojiBurst) => void;
    upsertTipRain:    (session: TipRainSession) => void;
    removeTipRain:    (userId: string) => void;
    setSessionInfo:   (info: SessionInfo | null) => void;
    setPinnedMessage:(msg: { id: string; userId: string; userName: string; message: string; pinnedAt: string } | null) => void;
}

const DEFAULT_AUDIO: CreatorAudio = { state: 'idle', chunks: [], mimeType: 'audio/webm' };

export const useRoomStore = create<RoomStore>((set) => ({
    room:                       null,
    chatMessages:               [],
    listenerCount:              0,
    isCreator:                  false,
    creatorDisconnectCountdown: null,
    creatorAway:                false,
    loading:                    false,
    error:                      null,
    creatorAudio:               { ...DEFAULT_AUDIO },
    broadcastAsset:             null,
    activeGame:                 null,
    gameSecondsLeft:            0,
    skipVotes:                  { count: 0, needed: 1 },
    reactions:                  { likes: 0, dislikes: 0 },
    nominations:                [],
    emojiBursts:                [],
    tipRainSessions:            {},
    sessionInfo:                null,
    pinnedMessage:              null,

    setRoom:          (room) => set({ room }),
    setIsCreator:     (isCreator) => set({ isCreator }),
    setListenerCount: (listenerCount) => set({ listenerCount }),

    updatePlaylistSongUrl: (index, audioUrl) => set((state) => {
        if (!state.room) return {};
        const playlist = [...state.room.playlist];
        playlist[index] = { ...playlist[index], audioUrl };
        return { room: { ...state.room, playlist } };
    }),

    addChatMessage: (msg) => set((state) => ({
        chatMessages: [...state.chatMessages, msg].slice(-100),
    })),

    setCreatorDisconnectCountdown: (creatorDisconnectCountdown) =>
        set({ creatorDisconnectCountdown }),
    setCreatorAway: (creatorAway) => set({ creatorAway }),

    setLoading: (loading) => set({ loading }),
    setError:   (error)   => set({ error }),

    reset: () => set({
        room:                       null,
        chatMessages:               [],
        listenerCount:              0,
        isCreator:                  false,
        creatorDisconnectCountdown: null,
        loading:                    false,
        error:                      null,
        creatorAudio:               { ...DEFAULT_AUDIO },
        broadcastAsset:             null,
        activeGame:                 null,
        gameSecondsLeft:            0,
        skipVotes:                  { count: 0, needed: 1 },
        reactions:                  { likes: 0, dislikes: 0 },
        nominations:                [],
        emojiBursts:                [],
        tipRainSessions:            {},
        sessionInfo:                null,
        pinnedMessage:              null,
    }),

    // Creator audio
    setCreatorAudioReceiving: () =>
        set({ creatorAudio: { state: 'receiving', chunks: [], mimeType: 'audio/webm' } }),

    addCreatorAudioChunk: (chunk, mimeType) =>
        set((s) => ({
            creatorAudio: {
                ...s.creatorAudio,
                chunks:   [...s.creatorAudio.chunks, chunk],
                mimeType: mimeType ?? s.creatorAudio.mimeType,
            },
        })),

    setCreatorAudioDone: () =>
        set((s) => ({ creatorAudio: { ...s.creatorAudio, state: 'done' } })),

    clearCreatorAudio: () =>
        set({ creatorAudio: { ...DEFAULT_AUDIO } }),

    // Broadcast asset
    setBroadcastAsset:   (broadcastAsset) => set({ broadcastAsset }),
    clearBroadcastAsset: () => set({ broadcastAsset: null }),

    // Feature flags live update
    updateFeatureFlags: (flags) => set((s) => {
        if (!s.room) return {};
        const current: RoomFeatureFlags = s.room.featureFlags ?? {
            liveMic: true, chat: true, donations: true, voting: true,
            minigames: true, voteQueue: true, broadcasts: true,
        };
        return { room: { ...s.room, featureFlags: { ...current, ...flags } } };
    }),

    // Minigame
    setActiveGame:      (activeGame) => set({ activeGame }),
    setGameSecondsLeft: (gameSecondsLeft) => set({ gameSecondsLeft }),

    // Voting & reactions
    setSkipVotes:   (skipVotes) => set({ skipVotes }),
    setReactions:   (reactions) => set({ reactions }),
    setNominations: (nominations) => set({ nominations }),
    addEmojiBurst:  (burst) => set((s) => ({
        emojiBursts: [...s.emojiBursts.slice(-19), burst],
    })),
    upsertTipRain: (session) => set((s) => ({
        tipRainSessions: { ...s.tipRainSessions, [session.userId]: session },
    })),
    removeTipRain: (userId) => set((s) => {
        const next = { ...s.tipRainSessions };
        delete next[userId];
        return { tipRainSessions: next };
    }),
    setSessionInfo:    (sessionInfo) => set({ sessionInfo }),
    setPinnedMessage:  (pinnedMessage) => set({ pinnedMessage }),
}));
