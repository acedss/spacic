import { create } from 'zustand';

interface ActiveRoomStore {
    activeRoomId: string | null;
    setActiveRoomId: (id: string | null) => void;
}

export const useActiveRoomStore = create<ActiveRoomStore>((set) => ({
    activeRoomId: null,
    setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
}));
