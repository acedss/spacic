import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Loader, LogOut } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomSession } from '@/providers/RoomSessionProvider';
import * as roomService from '@/lib/roomService';
import { RoomPlayer } from './components/RoomPlayer';
import { ChatPanel } from './components/ChatPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { DisconnectCountdown } from './components/DisconnectCountdown';

export const RoomPage = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { userId } = useAuth();

    const roomStore = useRoomStore();
    const playerStore = usePlayerStore();
    const { joinRoom, leaveRoom, sendChat, skipSong } = useRoomSession();

    useEffect(() => {
        if (!roomId) return;

        // Skip re-fetch if already loaded for this room (user navigated back)
        if (roomStore.room?._id === roomId) {
            joinRoom(roomId);
            return;
        }

        roomStore.setLoading(true);
        roomService.getRoomById(roomId)
            .then((room) => {
                roomStore.setRoom(room);
                const creatorClerkId = (room.creatorId as unknown as { clerkId: string })?.clerkId ?? room.creatorId;
                roomStore.setIsCreator(creatorClerkId === userId);
                playerStore.setCurrentSongIndex(room.playback?.currentSongIndex ?? 0);
                joinRoom(roomId); // signal provider to connect socket
            })
            .catch((err) => roomStore.setError(err.message))
            .finally(() => roomStore.setLoading(false));

        // No reset on unmount — socket and state persist for background listening.
        // Stores are only reset via explicit leaveRoom().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const handleClose = useCallback(async () => {
        if (!roomId) return;
        try {
            await roomService.closeRoom(roomId);
            leaveRoom();
            navigate('/');
        } catch {
            roomStore.setError('Failed to close room');
        }
    }, [roomId, navigate, roomStore, leaveRoom]);

    const handleLeave = useCallback(() => {
        leaveRoom();
        navigate('/');
    }, [leaveRoom, navigate]);

    if (roomStore.loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader className="size-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (roomStore.error && !roomStore.room) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <p className="text-red-400">{roomStore.error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
                >
                    Go Home
                </button>
            </div>
        );
    }

    if (roomStore.room?.status === 'closed') {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <h2 className="text-2xl font-semibold">This room is closed</h2>
                <p className="text-zinc-500 text-sm">The creator has ended the session.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
                >
                    Find Another Room
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-full gap-4 p-4 min-h-0 relative">
            {/* Leave button */}
            <button
                onClick={handleLeave}
                className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg text-xs text-zinc-300 transition-colors"
            >
                <LogOut className="size-3.5" />
                Leave
            </button>

            {/* Left: Player */}
            <div className="w-full md:w-72 flex-shrink-0">
                <RoomPlayer onSkip={skipSong} onClose={handleClose} />
            </div>

            {/* Right: Queue + Chat */}
            <div className="flex flex-col flex-1 gap-4 min-h-0 overflow-hidden">
                <PlaylistPanel />
                <div className="flex-1 min-h-0">
                    <ChatPanel onSendMessage={sendChat} />
                </div>
            </div>

            {roomStore.creatorDisconnectCountdown !== null && (
                <DisconnectCountdown countdown={roomStore.creatorDisconnectCountdown} />
            )}
        </div>
    );
};
