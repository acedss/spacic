// RoomSessionProvider: manages the room socket connection persistently.
// Lives in MainLayout — never unmounts during navigation, so the socket
// stays alive when the user browses away from the room page.
//
// Lifecycle:
//   joinRoom(id)  → sets activeRoomId → useRoomSocket connects
//   leaveRoom()   → resets stores + clears activeRoomId → useRoomSocket disconnects
//   Navigate away → activeRoomId unchanged → socket stays alive

import { createContext, useContext, useCallback } from 'react';
import { useRoomSocket } from '@/hooks/useRoomSocket';
import { useActiveRoomStore } from '@/stores/useActiveRoomStore';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

interface RoomSessionContextValue {
    activeRoomId: string | null;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    sendChat: (message: string) => void;
    skipSong: () => void;
    donate: (amount: number) => void;
    updateGoal: (newGoal: number) => void;
}

const RoomSessionContext = createContext<RoomSessionContextValue | null>(null);

export const RoomSessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeRoomId, setActiveRoomId } = useActiveRoomStore();
    const roomStore = useRoomStore();
    const playerStore = usePlayerStore();

    // Socket connection lives here — persists as long as this provider is mounted.
    // When activeRoomId is null or empty, the hook is a no-op (early return guard).
    const { sendChat, skipSong, leaveRoom: socketLeave, donate, updateGoal } = useRoomSocket(activeRoomId ?? '');

    const joinRoom = useCallback((roomId: string) => {
        setActiveRoomId(roomId);
    }, [setActiveRoomId]);

    const leaveRoom = useCallback(() => {
        socketLeave();           // emits room:leave + disconnects socket
        setActiveRoomId(null);   // clears activeRoomId → hook becomes no-op
        roomStore.reset();       // wipe room UI state
        playerStore.reset();     // stop playback
    }, [socketLeave, setActiveRoomId, roomStore, playerStore]);

    return (
        <RoomSessionContext.Provider value={{ activeRoomId, joinRoom, leaveRoom, sendChat, skipSong, donate, updateGoal }}>
            {children}
        </RoomSessionContext.Provider>
    );
};

export const useRoomSession = () => {
    const ctx = useContext(RoomSessionContext);
    if (!ctx) throw new Error('useRoomSession must be used within RoomSessionProvider');
    return ctx;
};
