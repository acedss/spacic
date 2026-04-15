import { create } from 'zustand';
import type { RoomInfo, ChatMessage, ActiveGame } from '@/types/types';

interface CreatorAudio {
    state:    'idle' | 'receiving' | 'done';
    chunks:   string[];
    mimeType: string;
}

interface RoomStore {
    room:                       RoomInfo | null;
    chatMessages:               ChatMessage[];
    listenerCount:              number;
    isCreator:                  boolean;
    creatorDisconnectCountdown: number | null;
    loading:                    boolean;
    error:                      string | null;

    // Creator mic audio relay
    creatorAudio: CreatorAudio;

    // Active minigame visible to all room members
    activeGame:      ActiveGame | null;
    gameSecondsLeft: number;

    setRoom:                      (room: RoomInfo) => void;
    setIsCreator:                 (isCreator: boolean) => void;
    setListenerCount:             (count: number) => void;
    updatePlaylistSongUrl:        (index: number, audioUrl: string) => void;
    addChatMessage:               (msg: ChatMessage) => void;
    setCreatorDisconnectCountdown:(seconds: number | null) => void;
    setLoading:                   (loading: boolean) => void;
    setError:                     (error: string | null) => void;
    reset:                        () => void;

    // Creator audio actions
    setCreatorAudioReceiving: () => void;
    addCreatorAudioChunk:     (chunk: string, mimeType?: string) => void;
    setCreatorAudioDone:      () => void;
    clearCreatorAudio:        () => void;

    // Minigame actions
    setActiveGame:      (game: ActiveGame | null) => void;
    setGameSecondsLeft: (secs: number) => void;
}

const DEFAULT_AUDIO: CreatorAudio = { state: 'idle', chunks: [], mimeType: 'audio/webm' };

export const useRoomStore = create<RoomStore>((set) => ({
    room:                       null,
    chatMessages:               [],
    listenerCount:              0,
    isCreator:                  false,
    creatorDisconnectCountdown: null,
    loading:                    false,
    error:                      null,
    creatorAudio:               { ...DEFAULT_AUDIO },
    activeGame:                 null,
    gameSecondsLeft:            0,

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
        activeGame:                 null,
        gameSecondsLeft:            0,
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

    // Minigame
    setActiveGame:      (activeGame) => set({ activeGame }),
    setGameSecondsLeft: (gameSecondsLeft) => set({ gameSecondsLeft }),
}));
