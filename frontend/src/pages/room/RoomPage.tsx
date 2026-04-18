import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { axiosInstance } from '@/lib/axios';
import { Loader, LogOut, Radio, Users, Clock, Gem, Heart, MessageSquare, Music2, Coins, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomSession } from '@/providers/RoomSessionProvider';
import * as roomService from '@/lib/roomService';
import { RoomPlayer } from './components/RoomPlayer';
import { ChatPanel } from './components/ChatPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { DisconnectCountdown } from './components/DisconnectCountdown';
import { DonationPanel } from './components/DonationPanel';
import { GuestAuthDialog } from './components/GuestAuthDialog';
import { CreatorSpeakingOverlay } from './components/CreatorSpeakingOverlay';
import { ListenerGamePanel } from './components/ListenerGamePanel';
import { VoteSkipButton } from './components/VoteSkipButton';
import { SongReactions } from './components/SongReactions';
import { EmojiBurstOverlay } from './components/EmojiBurstOverlay';
import { NominationsPanel } from './components/NominationsPanel';
import { SessionTimer } from './components/SessionTimer';
import type { RoomInfo } from '@/types/types';
import { cn } from '@/lib/utils';

type RightTab = 'chat' | 'queue' | 'donate' | 'vote';

export const RoomPage = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { userId, isSignedIn, isLoaded } = useAuth();

    const [guestDialogOpen, setGuestDialogOpen] = useState(false);
    const [rightTab, setRightTab] = useState<RightTab>('chat');

    const roomStore = useRoomStore();
    const playerStore = usePlayerStore();
    const { joinRoom, leaveRoom, sendChat, skipSong, donate, updateGoal, voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong } = useRoomSession();

    // Track referral once on mount — fire-and-forget, never blocks UX
    useEffect(() => {
        const ref  = searchParams.get('ref');
        const type = searchParams.get('type') ?? 'link';
        if (!ref || !roomId) return;
        axiosInstance.post(`/rooms/${roomId}/referral`, { ref, type }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // Show guest dialog once auth is resolved and user is not signed in
    useEffect(() => {
        if (isLoaded && !isSignedIn) setGuestDialogOpen(true);
    }, [isLoaded, isSignedIn]);

    useEffect(() => {
        if (!roomId) return;

        if (roomStore.room?._id === roomId && roomStore.room?.status === 'live') {
            if (isSignedIn) joinRoom(roomId);
            return;
        }

        roomStore.setLoading(true);
        roomService.getRoomById(roomId)
            .then((room) => {
                roomStore.setRoom(room);
                const creatorClerkId = (room.creatorId as unknown as { clerkId: string })?.clerkId ?? room.creatorId;
                roomStore.setIsCreator(creatorClerkId === userId);
                playerStore.setCurrentSongIndex(room.playback?.currentSongIndex ?? 0);
                if (room.status === 'live' && isSignedIn) joinRoom(roomId);
            })
            .catch((err) => roomStore.setError(err.message))
            .finally(() => roomStore.setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, isSignedIn]);

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
                <Button variant="ghost" onClick={() => navigate('/')} className="bg-white/10 hover:bg-white/20 rounded-lg text-sm">
                    Go Home
                </Button>
            </div>
        );
    }

    if (roomStore.room?.status === 'offline') {
        return <RoomOfflineView room={roomStore.room} onBack={() => navigate('/')} />;
    }

    return (
        <div className="flex flex-col md:flex-row h-full gap-3 p-3 min-h-0 relative">
            {/* Top-right action */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <SessionTimer />
                {isSignedIn ? (
                    <Button
                        onClick={handleLeave}
                        variant="ghost"
                        size="sm"
                        className="bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 rounded-lg text-xs text-zinc-300 backdrop-blur"
                    >
                        <LogOut className="size-3.5" />
                        Leave
                    </Button>
                ) : (
                    <Button
                        onClick={() => setGuestDialogOpen(true)}
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-500 text-white text-xs"
                    >
                        Join to listen
                    </Button>
                )}
            </div>

            {/* Left: Player + interactions */}
            <div className="w-full md:w-72 flex-shrink-0 flex flex-col gap-2">
                <RoomPlayer onSkip={skipSong} onClose={handleGoOffline} />
                {isSignedIn && (
                    <div className="flex items-center justify-between gap-2 px-1">
                        <SongReactions onReact={reactToSong} />
                        <VoteSkipButton onVoteSkip={voteSkip} />
                    </div>
                )}
                {isSignedIn && (
                    <div className="px-1">
                        <EmojiBurstOverlay onSendEmoji={sendEmoji} />
                    </div>
                )}
            </div>

            {/* Right: Tabbed panel */}
            <div className="flex flex-col flex-1 min-h-0 bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-3 pt-2.5 pb-0 border-b border-white/5 flex-shrink-0">
                    {([
                        { id: 'chat'   as RightTab, icon: MessageSquare, label: 'Chat' },
                        { id: 'queue'  as RightTab, icon: Music2,         label: 'Queue' },
                        { id: 'vote'   as RightTab, icon: Vote,           label: 'Vote' },
                        { id: 'donate' as RightTab, icon: Coins,          label: 'Donate' },
                    ] as const).map(({ id, icon: Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => setRightTab(id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                                rightTab === id
                                    ? 'text-white border-violet-500 bg-white/5'
                                    : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5',
                            )}
                        >
                            <Icon className="size-3.5" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {rightTab === 'chat' && (
                        <ChatPanel onSendMessage={sendChat} />
                    )}
                    {rightTab === 'queue' && (
                        <PlaylistPanel />
                    )}
                    {rightTab === 'vote' && (
                        <NominationsPanel onNominate={nominateSong} onVote={voteForSong} />
                    )}
                    {rightTab === 'donate' && (
                        <DonationPanel onDonate={donate} onUpdateGoal={updateGoal} isCreator={roomStore.isCreator} />
                    )}
                </div>
            </div>

            {/* Overlays */}
            {roomStore.creatorDisconnectCountdown !== null && (
                <DisconnectCountdown countdown={roomStore.creatorDisconnectCountdown} />
            )}

            {isSignedIn && !roomStore.isCreator && (
                <CreatorSpeakingOverlay creatorName={roomStore.room?.title} />
            )}

            {isSignedIn && !roomStore.isCreator && (
                <ListenerGamePanel />
            )}

            <GuestAuthDialog
                open={guestDialogOpen}
                onOpenChange={setGuestDialogOpen}
                roomTitle={roomStore.room?.title}
            />
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
            <Button variant="ghost" onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm text-white">
                Find Live Rooms
            </Button>
        </div>
    );
};
