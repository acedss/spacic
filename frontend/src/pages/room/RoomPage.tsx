import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { axiosInstance } from '@/lib/axios';
import { Loader, LogOut, Radio, Users, Clock, Gem, Heart, MessageSquare, Music2, Vote, WifiOff, Mic, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomSession } from '@/providers/RoomSessionProvider';
import * as roomService from '@/lib/roomService';
import { RoomPlayer } from './components/RoomPlayer';
import { ChatPanel } from './components/ChatPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { DonationPanel } from './components/DonationPanel';
import { GuestAuthDialog } from './components/GuestAuthDialog';
import { CreatorSpeakingOverlay } from './components/CreatorSpeakingOverlay';
import { RoomInfoModal } from './components/RoomInfoModal';
import { ListenerGamePanel } from './components/ListenerGamePanel';
import { VoteSkipButton } from './components/VoteSkipButton';
import { SongReactions } from './components/SongReactions';
import { EmojiBurstOverlay } from './components/EmojiBurstOverlay';
import { NominationsPanel } from './components/NominationsPanel';
import { SessionTimer } from './components/SessionTimer';
import type { RoomInfo } from '@/types/types';
import { cn } from '@/lib/utils';

type RightTab = 'chat' | 'tip' | 'goal';

/* ─── Constellation ─────────────────────────────────────────────────────── */
const Constellation = ({ room, listenerCount }: { room: RoomInfo; listenerCount: number }) => {
    const nodes = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 28 + (i % 3) * 9;
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius;
            const dx = ((i * 7) % 12) - 6;
            const dy = ((i * 11) % 10) - 5;
            const hue = (i * 31) % 360;
            return { i, x, y, dx, dy, delay: (i * 0.25) % 2, hue };
        });
    }, []);

    const coverUrl = (room as any).coverUrl ?? '';
    const creator = (room as any).creatorId as { fullName?: string; imageUrl?: string } | undefined;

    return (
        <div className="rounded-2xl ring-1 ring-white/10 p-5 h-fit glass relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="mono text-[9px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>Listening together</div>
                    <p className="text-[13px] text-white mt-1">
                        {listenerCount.toLocaleString()} people
                    </p>
                </div>
                <button className="inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[11px] ring-1 ring-white/10 hover:bg-white/8 transition-colors" style={{ color: 'var(--fg-2)' }}>
                    <Users className="size-3" /> All
                </button>
            </div>

            <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '5/4', background: 'radial-gradient(ellipse at center, oklch(0.22 0.06 295 / 0.6), oklch(0.12 0.02 285) 70%)' }}>
                {/* orbit rings */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <circle cx="50" cy="50" r="18" fill="none" stroke="oklch(1 0 0 / 0.05)" strokeDasharray="1 2" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="oklch(1 0 0 / 0.04)" strokeDasharray="1 2" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="oklch(1 0 0 / 0.03)" strokeDasharray="1 2" />
                </svg>

                {/* Host at center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
                    <div className="relative">
                        {creator?.imageUrl ? (
                            <img src={creator.imageUrl}
                                className="w-14 h-14 rounded-full object-cover ring-2 ring-[oklch(0.88_0.12_75)]"
                                style={{ boxShadow: '0 0 30px oklch(0.88 0.12 75 / 0.6)' }}
                                alt="" />
                        ) : (
                            <div className="w-14 h-14 rounded-full ring-2 ring-[oklch(0.88_0.12_75)]"
                                style={{ background: 'oklch(0.3 0.08 295)', boxShadow: '0 0 30px oklch(0.88 0.12 75 / 0.6)' }} />
                        )}
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] mono uppercase bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)] font-semibold tracking-wider">Host</span>
                    </div>
                </div>

                {/* Listener avatar dots */}
                {nodes.map(n => (
                    <div key={n.i} className="absolute drift"
                        style={{
                            left: `${n.x}%`, top: `${n.y}%`,
                            transform: 'translate(-50%,-50%)',
                            '--dx': `${n.dx}px`, '--dy': `${n.dy}px`,
                            animationDelay: `${n.delay}s`,
                        } as React.CSSProperties}>
                        <div className="w-8 h-8 rounded-full ring-2 ring-white/20"
                            style={{ background: `oklch(0.5 0.12 ${n.hue})` }} />
                        {n.i === 3 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[oklch(0.72_0.22_20)] ring-2 ring-[var(--ink-0)]" />}
                    </div>
                ))}

                {/* Country badges */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                    {['🇩🇪 Berlin', '🇯🇵 Tokyo', '🇳🇬 Lagos', '🇨🇱 Santiago', '+38 cities'].map((t, i) => (
                        <span key={i} className="mono text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-white/70 ring-1 ring-white/10">{t}</span>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--fg-2)' }}>
                    <Mic className="size-3 text-[oklch(0.72_0.22_20)]" />
                    <span>{creator?.fullName ?? 'Host'} is speaking</span>
                </div>
                <span className="ml-auto inline-flex items-end gap-[2px] text-[oklch(0.72_0.22_20)]">
                    {[8, 13, 9, 12].map((h, i) => (
                        <span key={i} style={{ width: 2, height: h, background: 'currentColor', borderRadius: 1, opacity: 0.8, animation: `wf ${0.9 + i * 0.2}s ease-in-out ${i * 0.2}s infinite alternate` }} />
                    ))}
                </span>
            </div>
        </div>
    );
};

// Seeded PRNG — generates a repeatable waveform shape per song
const seededWaveform = (seed: string, count: number): number[] => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
        h = (h * 16807 + 12345) & 0x7fffffff;
        const base = (h % 1000) / 1000;
        const envelope = 0.3 + 0.7 * Math.sin((i / count) * Math.PI);
        const cluster = 0.5 + 0.5 * Math.sin(i * 0.15 + (h % 100) * 0.01);
        bars.push(Math.max(0.08, base * envelope * cluster));
    }
    return bars;
};

/* ─── NowMoment — creator pinned message + waveform timeline ───────────── */
const NowMoment = ({ room }: { room: RoomInfo }) => {
    const creator = (room as any).creatorId as { fullName?: string; imageUrl?: string } | undefined;
    const pinnedMessage = useRoomStore(s => s.pinnedMessage);
    const currentTimeMs = usePlayerStore(s => s.currentTimeMs);
    const currentSongIndex = usePlayerStore(s => s.currentSongIndex);
    const currentSong = room.playlist[currentSongIndex];
    const duration = currentSong?.duration ?? 0;
    const progressPct = duration > 0 ? Math.min(100, (currentTimeMs / 1000 / duration) * 100) : 0;
    const waveBars = useMemo(
        () => seededWaveform(currentSong?.title ?? room.title ?? 'spacic', 80),
        [currentSong?.title, room.title]
    );

    return (
        <div className="rounded-2xl ring-1 ring-white/10 glass overflow-hidden">
            {pinnedMessage ? (
                <div className="p-5 flex items-start gap-4">
                    {creator?.imageUrl && (
                        <img src={creator.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20 shrink-0" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-white font-medium">{pinnedMessage.userName || creator?.fullName || 'Host'}</span>
                            <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-0.5 bg-[oklch(0.68_0.21_295_/_0.15)] text-[oklch(0.82_0.14_295)] ring-1 ring-[oklch(0.68_0.21_295_/_0.3)]">
                                Pinned
                            </span>
                            <span className="mono text-[10px] uppercase tracking-wider ml-auto" style={{ color: 'var(--fg-3)' }}>
                                {new Date(pinnedMessage.pinnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="serif italic text-[20px] text-white leading-snug mt-2">
                            "{pinnedMessage.message}"
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-5 flex items-start gap-4">
                    {creator?.imageUrl && (
                        <img src={creator.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20 shrink-0" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] text-white font-medium">{creator?.fullName ?? 'Host'}</span>
                            <span className="mono text-[10px] uppercase tracking-wider ml-auto" style={{ color: 'var(--fg-3)' }}>No pin yet</span>
                        </div>
                        <p className="text-[13px] mt-2" style={{ color: 'var(--fg-3)' }}>
                            The creator hasn't pinned a message yet. Hover a chat message and click 📌 to pin it.
                        </p>
                    </div>
                </div>
            )}

            {/* waveform timeline */}
            <div className="px-5 pb-4 pt-1 relative border-t hair" style={{ background: 'var(--ink-2)' }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Live waveform</div>
                    <div className="mono text-[11px] tabular-nums" style={{ color: 'var(--fg-2)' }}>−12 LUFS</div>
                </div>
                <div className="relative h-14 flex items-end gap-[1.5px]">
                    {waveBars.map((h, i) => {
                        const barPct = (i / waveBars.length) * 100;
                        const past = barPct < progressPct;
                        const nearHead = Math.abs(barPct - progressPct) < 4;
                        return (
                            <span key={i} className={nearHead ? 'animate-pulse' : ''} style={{
                                height: `${h * 100}%`, flex: 1, minWidth: 2, maxWidth: 5,
                                background: past
                                    ? `linear-gradient(180deg, oklch(0.88 0.12 ${75 + i * 0.8}), oklch(0.65 0.18 295))`
                                    : 'oklch(1 0 0 / 0.12)',
                                borderRadius: 2,
                                transition: 'background 0.3s',
                            }} />
                        );
                    })}
                    <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${progressPct}%` }}>
                        <div className="w-px h-full bg-white/80" />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 mono text-[9px] text-white bg-black/70 px-1.5 py-0.5 rounded ring-1 ring-white/20">now</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── ReactionsRow ──────────────────────────────────────────────────────── */
const ReactionsRow = ({ onReact, onSendEmoji, onVoteSkip, onDonate }: {
    onReact: (reaction: string) => void;
    onSendEmoji: (emoji: string) => void;
    onVoteSkip: () => void;
    onDonate: (amount: number) => void;
}) => {
    const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
    const { skipVotes, reactions, emojiBursts } = useRoomStore();
    const REACTIONS = ['❤️', '🔥', '✨', '🥲', '🕺', '👏'];

    const pop = (emoji: string) => {
        const id = Date.now();
        setBursts(b => [...b, { id, emoji, x: 30 + Math.random() * 50 }]);
        setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 2600);
        onSendEmoji(emoji);
    };

    // Merge local bursts + remote bursts from store
    const allBursts = [
        ...bursts,
        ...emojiBursts.map(b => ({ id: Number(b.id.split('-')[0]), emoji: b.emoji, x: 20 + Math.random() * 60 })),
    ];

    return (
        <div className="rounded-2xl ring-1 ring-white/10 glass p-4 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
                <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>React</div>
                <span className="text-[11px]" style={{ color: 'var(--fg-2)' }}>Your vibes show up for everyone in the room</span>
            </div>

            {/* Like / Dislike */}
            <div className="flex items-center gap-2 mb-3">
                <button onClick={() => onReact('like')}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl ring-1 ring-[oklch(0.74_0.14_160_/_0.3)] bg-[oklch(0.74_0.14_160_/_0.08)] text-[oklch(0.74_0.14_160)] text-[12px] press hover:bg-[oklch(0.74_0.14_160_/_0.15)]">
                    <ThumbsUp className="size-3.5" /> {reactions.likes}
                </button>
                <button onClick={() => onReact('dislike')}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl ring-1 ring-white/10 bg-white/5 text-[12px] press hover:bg-white/8"
                    style={{ color: 'var(--fg-2)' }}>
                    <ThumbsDown className="size-3.5" /> {reactions.dislikes}
                </button>
                <div className="flex-1" />
                <button onClick={onVoteSkip}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/8 press"
                    style={{ color: 'var(--fg-1)' }}>
                    <Vote className="size-3.5" />
                    Skip {skipVotes.count}/{skipVotes.needed}
                </button>
                <button
                    onClick={() => onDonate(500)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[oklch(0.88_0.12_75)] text-[oklch(0.18_0.02_80)] text-[12px] font-semibold press">
                    <Gem className="size-3.5" /> Tip 500
                </button>
            </div>

            {/* Emoji row */}
            <div className="flex items-center gap-2">
                {REACTIONS.map(e => (
                    <button key={e} onClick={() => pop(e)}
                        className="w-10 h-10 rounded-xl grid place-items-center bg-white/6 hover:bg-white/12 ring-1 ring-white/10 text-[18px] press">
                        {e}
                    </button>
                ))}
            </div>

            {/* Emoji bursts — local + remote */}
            <div className="absolute inset-0 pointer-events-none">
                {allBursts.map(b => (
                    <span key={b.id} className="absolute text-[28px] animate-float-up"
                        style={{ left: `${b.x}%`, bottom: 10 }}>{b.emoji}</span>
                ))}
            </div>
        </div>
    );
};

/* ─── RightRail ─────────────────────────────────────────────────────────── */
const RightRail = ({
    tab, setTab, onSendChat, onDonate, onUpdateGoal, isCreator, onPinMessage,
}: {
    tab: RightTab; setTab: (t: RightTab) => void;
    onSendChat: (msg: string) => void;
    onDonate: (amount: number, message?: string) => void;
    onUpdateGoal: (goal: number, description?: string) => void;
    isCreator: boolean;
    onPinMessage: (messageId: string, message: string, userId: string, userName: string) => void;
}) => {
    const { room } = useRoomStore();
    const goalPct = room ? Math.min(100, Math.round(((room as any).streamGoalCurrent ?? 0) / Math.max(1, (room as any).streamGoal ?? 1) * 100)) : 0;

    return (
        <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden flex flex-col h-full" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
            {/* Tabs */}
            <div className="flex border-b hair flex-shrink-0">
                {([
                    { id: 'chat' as RightTab, label: 'Chat', icon: MessageSquare },
                    { id: 'tip' as RightTab, label: 'Tip', icon: Gem },
                    { id: 'goal' as RightTab, label: 'Goal', icon: Music2 },
                ] as const).map(({ id, label, icon: Icon }) => {
                    const on = tab === id;
                    return (
                        <button key={id} onClick={() => setTab(id)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] border-b-2 -mb-px press transition-colors',
                                on ? 'text-white border-[oklch(0.82_0.15_75)]' : 'border-transparent hover:text-[var(--fg-1)]',
                            )}
                            style={{ color: on ? 'white' : 'var(--fg-3)' }}>
                            <Icon className="size-3.5" />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                {tab === 'chat' && <ChatPanel onSendMessage={onSendChat} onPinMessage={onPinMessage} isCreator={isCreator} />}
                {tab === 'tip' && <DonationPanel onDonate={onDonate} onUpdateGoal={onUpdateGoal} isCreator={isCreator} />}
                {tab === 'goal' && (
                    <div className="p-5 overflow-auto h-full hide-scrollbar">
                        <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>Tonight's goal</div>
                        <h3 className="serif text-[26px] leading-tight text-white italic">{room?.title ?? 'Stream Goal'}</h3>

                        <div className="mt-5 p-4 rounded-xl ring-1 ring-white/10 bg-white/4">
                            <div className="flex items-baseline justify-between">
                                <span className="mono text-[28px] text-white tabular-nums">
                                    {(room as any)?.streamGoalCurrent ?? 0}
                                    <span className="text-[14px]" style={{ color: 'var(--fg-3)' }}> / {(room as any)?.streamGoal ?? 0}</span>
                                </span>
                                <span className="mono text-[11px] text-[oklch(0.88_0.12_75)] tabular-nums">{goalPct}%</span>
                            </div>
                            <div className="mt-2 h-2 bg-white/8 rounded-full overflow-hidden">
                                <div className="h-full rounded-full line-scan"
                                    style={{ width: `${goalPct}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                            </div>
                        </div>

                        <div className="mt-6 mono text-[9px] uppercase tracking-widest mb-3" style={{ color: 'var(--fg-3)' }}>Milestones</div>
                        {[
                            { at: 100, label: 'Unreleased song preview', done: true },
                            { at: 300, label: 'Shout-out from the host', done: true },
                            { at: 500, label: 'Secret track reveal', done: false, here: true },
                            { at: 750, label: 'Live Q&A extension', done: false },
                            { at: 1000, label: 'Physical vinyl raffle', done: false },
                        ].map(m => (
                            <div key={m.at} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                                <span className={cn(
                                    'w-6 h-6 rounded-full grid place-items-center text-[10px] mono ring-1',
                                    m.done ? 'bg-[oklch(0.74_0.14_160)] ring-[oklch(0.74_0.14_160)] text-[var(--ink-0)]'
                                        : m.here ? 'bg-[oklch(0.82_0.15_75_/_0.2)] ring-[oklch(0.82_0.15_75)] text-[oklch(0.88_0.12_75)]'
                                            : 'bg-white/4 ring-white/12 text-[var(--fg-3)]',
                                )}>
                                    {m.done ? '✓' : m.at}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[12px] ${m.done ? 'text-white/70 line-through' : m.here ? 'text-white' : 'text-[var(--fg-2)]'}`}>
                                        {m.label}
                                    </p>
                                    {m.here && <p className="text-[10px] text-[oklch(0.88_0.12_75)] mono uppercase tracking-wider mt-0.5">173 coins to unlock</p>}
                                </div>
                                <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>{m.at}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── RoomPage ──────────────────────────────────────────────────────────── */
export const RoomPage = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { userId, isSignedIn, isLoaded } = useAuth();

    const [guestDialogOpen, setGuestDialogOpen] = useState(false);
    const [rightTab, setRightTab] = useState<RightTab>('chat');

    const roomStore = useRoomStore();
    const { creatorAway } = useRoomStore();
    const playerStore = usePlayerStore();
    const { joinRoom, leaveRoom, sendChat, skipSong, donate, updateGoal, voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong, pinMessage } = useRoomSession();

    // Track referral
    useEffect(() => {
        const ref = searchParams.get('ref');
        const type = searchParams.get('type') ?? 'link';
        if (!ref || !roomId) return;
        axiosInstance.post(`/rooms/${roomId}/referral`, { ref, type }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // Show guest dialog when not signed in
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
            {/* Atmospheric cover blur */}
            {coverUrl && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <img src={coverUrl} className="w-full h-[620px] object-cover opacity-50 blur-3xl scale-110" alt="" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, oklch(0.08 0.015 285 / 0.6) 0%, oklch(0.08 0.015 285 / 0.95) 60%)' }} />
                </div>
            )}

            <div className="relative flex flex-col flex-1 min-h-0">
                {/* Header bar */}
                <div className="flex items-center justify-between px-8 h-16 border-b hair flex-shrink-0 glass">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                            <span className="live-dot" style={{ width: 5, height: 5 }} />
                            Live
                        </span>
                        {roomStore.room && (
                            <>
                                <div className="h-4 w-px bg-white/15" />
                                <span className="text-[12px]" style={{ color: 'var(--fg-2)' }}>
                                    in{' '}
                                    <span className="serif italic text-[16px] text-white">{roomStore.room.title}</span>
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                            Synced · 38ms
                        </span>
                        <SessionTimer />
                        {roomStore.room && <RoomInfoModal room={roomStore.room} />}
                        {isSignedIn ? (
                            <button onClick={handleLeave}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.1)] text-[oklch(0.82_0.17_20)] press hover:bg-[oklch(0.72_0.22_20_/_0.2)]">
                                <LogOut className="size-3.5" /> Leave room
                            </button>
                        ) : (
                            <button onClick={() => setGuestDialogOpen(true)}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] bg-white text-[var(--ink-0)] font-semibold press">
                                Join to listen
                            </button>
                        )}
                    </div>
                </div>

                {/* ── 3-column grid ──────────────────────────────────────── */}
                <div className="grid grid-cols-12 gap-4 p-6 flex-1 min-h-0 overflow-hidden">

                    {/* Col 1–4: Player + Constellation */}
                    <div className="col-span-4 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
                        {creatorAway && !roomStore.isCreator && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1 ring-[oklch(0.78_0.18_75_/_0.3)] bg-[oklch(0.78_0.18_75_/_0.08)] text-[oklch(0.88_0.12_75)] text-[12px]">
                                <WifiOff className="size-3 flex-shrink-0" />
                                Creator temporarily away — music continues
                            </div>
                        )}
                        <RoomPlayer onSkip={skipSong} onClose={handleGoOffline} />
                        {roomStore.room && (
                            <Constellation room={roomStore.room} listenerCount={roomStore.listenerCount} />
                        )}
                    </div>

                    {/* Col 5–9: NowMoment + Reactions + Queue */}
                    <div className="col-span-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
                        {roomStore.room && (
                            <NowMoment room={roomStore.room} />
                        )}

                        {isSignedIn && (
                            <ReactionsRow
                                onReact={reactToSong}
                                onSendEmoji={sendEmoji}
                                onVoteSkip={voteSkip}
                                onDonate={donate}
                            />
                        )}

                        {/* Queue — nominations/vote */}
                        <div className="rounded-2xl ring-1 ring-white/10 glass flex-1 overflow-hidden min-h-0">
                            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b hair">
                                <div className="flex items-center gap-2">
                                    <Music2 className="size-3.5" style={{ color: 'var(--fg-2)' }} />
                                    <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Up next · Queue</span>
                                </div>
                            </div>
                            <div className="overflow-auto h-full">
                                <NominationsPanel onNominate={nominateSong} onVote={voteForSong} />
                            </div>
                        </div>
                    </div>

                    {/* Col 10–12: Chat / Tip / Goal */}
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

            {/* Overlays */}
            {isSignedIn && !roomStore.isCreator && <CreatorSpeakingOverlay creatorName={roomStore.room?.title} />}
            {isSignedIn && !roomStore.isCreator && <ListenerGamePanel />}

            <GuestAuthDialog
                open={guestDialogOpen}
                onOpenChange={setGuestDialogOpen}
                roomTitle={roomStore.room?.title}
            />
        </div>
    );
};

/* ─── Offline view ──────────────────────────────────────────────────────── */
const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const RoomOfflineView = ({ room, onBack }: { room: RoomInfo; onBack: () => void }) => {
    const s = room.stats;
    const stats = [
        { icon: Users, label: 'Listeners', value: s?.totalListeners?.toLocaleString() ?? '0' },
        { icon: Clock, label: 'Hours Listened', value: toHours(s?.totalMinutesListened ?? 0) },
        { icon: Gem, label: 'Coins Earned', value: s?.totalCoinsEarned?.toLocaleString() ?? '0' },
        { icon: Users, label: 'Unique Donors', value: s?.totalDonors?.toLocaleString() ?? '0' },
        { icon: Heart, label: 'Favorites', value: room.favoriteCount?.toLocaleString() ?? '0' },
        { icon: Radio, label: 'Sessions Hosted', value: s?.totalSessions?.toLocaleString() ?? '0' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-8 gap-8" style={{ background: 'var(--ink-0)' }}>
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Creator is offline</span>
                </div>
                <h1 className="serif text-white leading-tight" style={{ fontSize: 48 }}>{room.title}</h1>
                {room.description && (
                    <p className="text-[14px] max-w-md mx-auto leading-relaxed" style={{ color: 'var(--fg-2)' }}>{room.description}</p>
                )}
            </div>

            {s && (
                <div className="w-full max-w-lg grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stats.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-xl p-4 ring-1 ring-white/8" style={{ background: 'var(--ink-2)' }}>
                            <Icon className="size-4 mb-2 opacity-50 text-white" />
                            <p className="mono text-[22px] text-white tabular-nums leading-none">{value}</p>
                            <p className="mono text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Check back when the creator goes live.</p>
            <button onClick={onBack} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                Find Live Rooms
            </button>
        </div>
    );
};
