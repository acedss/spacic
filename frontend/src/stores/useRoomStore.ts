import { create } from 'zustand';
import type { RoomInfo, ChatMessage } from '@/types/types';

interface RoomStore {
    room: RoomInfo | null;
    chatMessages: ChatMessage[];
    listenerCount: number;
    isCreator: boolean;
    creatorDisconnectCountdown: number | null;
    loading: boolean;
    error: string | null;

    setRoom: (room: RoomInfo) => void;
    setIsCreator: (isCreator: boolean) => void;
    setListenerCount: (count: number) => void;
    updatePlaylistSongUrl: (index: number, audioUrl: string) => void;
    addChatMessage: (msg: ChatMessage) => void;
    setCreatorDisconnectCountdown: (seconds: number | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
    room: null,
    chatMessages: [],
    listenerCount: 0,
    isCreator: false,
    creatorDisconnectCountdown: null,
    loading: false,
    error: null,

    setRoom: (room) => set({ room }),
    setIsCreator: (isCreator) => set({ isCreator }),
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
    setError: (error) => set({ error }),
    reset: () => set({
        room: null,
        chatMessages: [],
        listenerCount: 0,
        isCreator: false,
        creatorDisconnectCountdown: null,
        loading: false,
        error: null,
    }),
}));
