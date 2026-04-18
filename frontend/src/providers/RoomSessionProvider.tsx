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
    joinRoom:     (roomId: string) => void;
    leaveRoom:    () => void;
    sendChat:     (message: string) => void;
    skipSong:     () => void;
    donate:       (amount: number) => void;
    updateGoal:   (newGoal: number) => void;
    submitAnswer: (minigameId: string, answer: string) => void;
    voteSkip:     () => void;
    reactToSong:  (reaction: 'like' | 'dislike') => void;
    sendEmoji:    (emoji: string) => void;
    nominateSong: (songId: string) => void;
    voteForSong:  (songId: string) => void;
}

const RoomSessionContext = createContext<RoomSessionContextValue | null>(null);

export const RoomSessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { activeRoomId, setActiveRoomId } = useActiveRoomStore();
    const roomStore   = useRoomStore();
    const playerStore = usePlayerStore();

    const { sendChat, skipSong, leaveRoom: socketLeave, donate, updateGoal, submitAnswer, voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong } =
        useRoomSocket(activeRoomId ?? '');

    const joinRoom = useCallback((roomId: string) => {
        setActiveRoomId(roomId);
    }, [setActiveRoomId]);

    const leaveRoom = useCallback(() => {
        socketLeave();
        setActiveRoomId(null);
        roomStore.reset();
        playerStore.reset();
    }, [socketLeave, setActiveRoomId, roomStore, playerStore]);

    return (
        <RoomSessionContext.Provider value={{
            activeRoomId, joinRoom, leaveRoom, sendChat, skipSong, donate, updateGoal, submitAnswer,
            voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong,
        }}>
            {children}
        </RoomSessionContext.Provider>
    );
};

export const useRoomSession = () => {
    const ctx = useContext(RoomSessionContext);
    if (!ctx) throw new Error('useRoomSession must be used within RoomSessionProvider');
    return ctx;
};
