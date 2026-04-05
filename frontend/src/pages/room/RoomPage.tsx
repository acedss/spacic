import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Loader, LogOut, Radio, Users, Clock, Gem, Heart } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomSession } from '@/providers/RoomSessionProvider';
import * as roomService from '@/lib/roomService';
import { RoomPlayer } from './components/RoomPlayer';
import { ChatPanel } from './components/ChatPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { DisconnectCountdown } from './components/DisconnectCountdown';
import { DonationPanel } from './components/DonationPanel';
import type { RoomInfo } from '@/types/types';

export const RoomPage = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { userId } = useAuth();

    const roomStore = useRoomStore();
    const playerStore = usePlayerStore();
    const { joinRoom, leaveRoom, sendChat, skipSong, donate, updateGoal } = useRoomSession();

    useEffect(() => {
        if (!roomId) return;

        // Skip re-fetch only if already connected AND live — never reuse stale offline state
        if (roomStore.room?._id === roomId && roomStore.room?.status === 'live') {
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
                // Only connect socket for live rooms
                if (room.status === 'live') joinRoom(roomId);
            })
            .catch((err) => roomStore.setError(err.message))
            .finally(() => roomStore.setLoading(false));

        // No reset on unmount — socket and state persist for background listening.
        // Stores are only reset via explicit leaveRoom().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const handleGoOffline = useCallback(async () => {
        if (!roomId) return;
        try {
            await roomService.goOffline(roomId);
        } catch {
            roomStore.setError('Failed to go offline');
        }
    }, [roomId, roomStore]);

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

    if (roomStore.room?.status === 'offline') {
        return <RoomOfflineView room={roomStore.room} onBack={() => navigate('/')} />;
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
                <RoomPlayer onSkip={skipSong} onClose={handleGoOffline} />
            </div>

            {/* Right: Queue + Chat + Donation */}
            <div className="flex flex-col flex-1 gap-4 min-h-0 overflow-hidden">
                <PlaylistPanel />
                <DonationPanel onDonate={donate} onUpdateGoal={updateGoal} isCreator={roomStore.isCreator} />
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

// ── Offline state view ────────────────────────────────────────────────────

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const RoomOfflineView = ({ room, onBack }: { room: RoomInfo; onBack: () => void }) => {
    const s = room.stats;
    const stats = [
        { icon: Users,  label: 'Total Listeners',  value: s?.totalListeners?.toLocaleString() ?? '0',      color: 'bg-blue-500/30' },
        { icon: Clock,  label: 'Hours Listened',    value: toHours(s?.totalMinutesListened ?? 0),            color: 'bg-indigo-500/30' },
        { icon: Gem,    label: 'Coins Earned',      value: s?.totalCoinsEarned?.toLocaleString() ?? '0',    color: 'bg-yellow-500/30' },
        { icon: Users,  label: 'Unique Donors',     value: s?.totalDonors?.toLocaleString() ?? '0',         color: 'bg-pink-500/30' },
        { icon: Heart,  label: 'Favorites',         value: room.favoriteCount?.toLocaleString() ?? '0',     color: 'bg-red-500/30' },
        { icon: Radio,  label: 'Sessions Hosted',   value: s?.totalSessions?.toLocaleString() ?? '0',       color: 'bg-purple-500/30' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-4 gap-8">
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm mb-4">
                    <span className="size-2 rounded-full bg-zinc-600" />
                    Creator is offline
                </div>
                <h1 className="text-3xl font-bold text-white">{room.title}</h1>
                {room.description && (
                    <p className="text-zinc-400 text-sm max-w-md">{room.description}</p>
                )}
            </div>

            {s && (
                <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stats.map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                            <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                                <Icon className="size-3.5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white leading-none">{value}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-zinc-600 text-sm">Check back later when the creator goes live.</p>
            <button
                onClick={onBack}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm text-white transition-colors"
            >
                Find Live Rooms
            </button>
        </div>
    );
};
