import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { axiosInstance } from '@/lib/axios';
import { Loader, Radio, WifiOff } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomSession } from '@/providers/RoomSessionProvider';
import * as roomService from '@/lib/roomService';

import { RoomPlayer } from './components/RoomPlayer';
import { GuestAuthDialog } from './components/GuestAuthDialog';
import { CreatorSpeakingOverlay } from './components/CreatorSpeakingOverlay';
import { ListenerGamePanel } from './components/ListenerGamePanel';
import { NominationsPanel } from './components/NominationsPanel';
import { TipRainOverlay } from './components/TipRainOverlay';
import { Constellation } from './components/Constellation';
import { NowMoment } from './components/NowMoment';
import { ReactionsRow } from './components/ReactionsRow';
import { RightRail, type RightTab } from './components/RightRail';
import { RoomHeader } from './components/RoomHeader';
import { RoomOfflineView } from './components/RoomOfflineView';

export const RoomPage = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { userId, isSignedIn, isLoaded } = useAuth();

    const [guestDialogOpen, setGuestDialogOpen] = useState(false);
    const [rightTab, setRightTab] = useState<RightTab>('chat');
    const [copied, setCopied] = useState(false);
    const [listenerHistory, setListenerHistory] = useState<number[]>([]);
    const listenerHistoryRef = useRef<number[]>([]);

    const roomStore = useRoomStore();
    const { creatorAway } = useRoomStore();
    const playerStore = usePlayerStore();
    const { joinRoom, leaveRoom, sendChat, skipSong, donate, tipHolding, updateGoal, voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong, pinMessage } = useRoomSession();

    useEffect(() => {
        const ref = searchParams.get('ref');
        const type = searchParams.get('type') ?? 'link';
        if (!ref || !roomId) return;
        axiosInstance.post(`/rooms/${roomId}/referral`, { ref, type }).catch(() => { });

    }, [roomId]);

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

    }, [roomId, isSignedIn]);

    useEffect(() => {
        listenerHistoryRef.current = [...listenerHistoryRef.current.slice(-29), roomStore.listenerCount];
        setListenerHistory([...listenerHistoryRef.current]);
    }, [roomStore.listenerCount]);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const handleGoOffline = useCallback(async () => {
        if (!roomId) return;
        try { await roomService.goOffline(roomId); }
        catch { roomStore.setError('Failed to go offline'); }
    }, [roomId, roomStore]);

    const handleLeave = useCallback(() => { leaveRoom(); navigate('/'); }, [leaveRoom, navigate]);

    if (roomStore.loading) {
        return (
            <div className="flex items-center justify-center h-full flex-col gap-4">
                <Loader className="size-7 animate-spin text-[oklch(0.88_0.12_75)]" />
                <span className="mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Joining room…</span>
            </div>
        );
    }

    if (roomStore.error && !roomStore.room) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <Radio className="size-10 opacity-30 text-white" />
                <p className="text-[oklch(0.82_0.17_20)] text-[14px]">{roomStore.error}</p>
                <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                    Go Home
                </button>
            </div>
        );
    }

    if (roomStore.room?.status === 'offline') {
        return <RoomOfflineView room={roomStore.room} onBack={() => navigate('/')} />;
    }

    const coverUrl = (roomStore.room as any)?.coverUrl ?? '';

    return (
        <div className="relative h-full flex flex-col" style={{ background: 'var(--ink-0)' }}>
            {coverUrl && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <img src={coverUrl} className="w-full h-155 object-cover opacity-50 blur-3xl scale-110" alt="" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, oklch(0.08 0.015 285 / 0.6) 0%, oklch(0.08 0.015 285 / 0.95) 60%)' }} />
                </div>
            )}

            <div className="relative flex flex-col flex-1 min-h-0">
                <RoomHeader
                    room={roomStore.room}
                    isSignedIn={isSignedIn}
                    copied={copied}
                    onCopyLink={handleCopyLink}
                    onLeave={handleLeave}
                    onJoinAsGuest={() => setGuestDialogOpen(true)}
                />

                <div className="grid grid-cols-12 gap-4 p-6 flex-1 min-h-0 overflow-hidden">
                    <div className="col-span-4 flex flex-col gap-4 overflow-y-auto hide-scrollbar min-h-0">
                        {creatorAway && !roomStore.isCreator && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1 ring-[oklch(0.78_0.18_75_/_0.3)] bg-[oklch(0.78_0.18_75_/_0.08)] text-[oklch(0.88_0.12_75)] text-[12px]">
                                <WifiOff className="size-3 flex-shrink-0" />
                                Creator temporarily away — music continues
                            </div>
                        )}
                        <RoomPlayer onSkip={skipSong} onClose={handleGoOffline} onReact={reactToSong} />
                        {roomStore.room && (
                            <Constellation room={roomStore.room} listenerCount={roomStore.listenerCount} listenerHistory={listenerHistory} />
                        )}
                    </div>

                    <div className="col-span-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar min-h-0">
                        {roomStore.room && <NowMoment room={roomStore.room} />}

                        {isSignedIn && (
                            <ReactionsRow
                                onSendEmoji={sendEmoji}
                                onVoteSkip={voteSkip}
                                onDonate={donate}
                                onTipHolding={tipHolding}
                            />
                        )}

                        <div className="rounded-2xl ring-1 ring-white/10 glass overflow-hidden flex-1 min-h-[320px] flex flex-col">
                            <div className="flex-1 min-h-0">
                                <NominationsPanel
                                    onNominate={nominateSong}
                                    onVote={voteForSong}
                                    onRequestSong={(req) => sendChat(`🎵 Song request: ${req}`)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-3 flex flex-col min-h-0 overflow-hidden">
                        <RightRail
                            tab={rightTab}
                            setTab={setRightTab}
                            onSendChat={sendChat}
                            onDonate={donate}
                            onUpdateGoal={updateGoal}
                            isCreator={roomStore.isCreator}
                            onPinMessage={pinMessage}
                        />
                    </div>
                </div>
            </div>

            {isSignedIn && !roomStore.isCreator && <CreatorSpeakingOverlay creatorName={roomStore.room?.title} />}
            {isSignedIn && !roomStore.isCreator && <ListenerGamePanel />}

            <TipRainOverlay />

            <GuestAuthDialog
                open={guestDialogOpen}
                onOpenChange={setGuestDialogOpen}
                roomTitle={roomStore.room?.title}
            />
        </div>
    );
};
