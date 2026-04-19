// Creator Live Page — monitoring dashboard while room is broadcasting.
// Rendered inside MainLayout so left sidebar + playback footer are available.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { io as connectSocket, Socket } from 'socket.io-client';
import {
    Radio, Users, Gem, Loader2, SkipForward, Crown, Clock, Send, Mic, Gamepad2, Coins,
} from 'lucide-react';
import { getMyRoom, goOffline } from '@/lib/roomService';
import { getMinigamesForRoom } from '@/lib/minigameService';
import { listBroadcastAssets } from '@/lib/broadcastService';
import type { RoomInfo, ChatMessage, Minigame, ActiveGame, Song, BroadcastAsset } from '@/types/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { EditPlaylistDialog } from './components/EditPlaylistDialog';
import { StreamGoalPanel } from './components/StreamGoalPanel';
import { MinigamePanel } from './components/MinigamePanel';
import { DonationFeed } from './components/DonationFeed';
import { BroadcastPanel } from './components/BroadcastPanel';
import { useWalletStore } from '@/stores/useWalletStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

interface LiveStats {
    listenerCount:    number;
    coinsThisSession: number;
}

const StatBadge = ({ icon: Icon, value, label, color }: {
    icon: React.ElementType; value: string | number; label: string; color: string
}) => (
    <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-w-[100px]">
        <Icon className={cn('size-4 flex-shrink-0', color)} />
        <div>
            <p className="text-sm font-bold text-white tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
        </div>
    </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const CreatorLivePage = () => {
    const navigate    = useNavigate();
    const { userId: clerkId } = useAuth();
    const { balance: creatorBalance } = useWalletStore();

    const [room, setRoom]         = useState<RoomInfo | null>(null);
    const [loading, setLoading]   = useState(true);
    const [toggling, setToggling] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0);

    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<LiveStats>({ listenerCount: 0, coinsThisSession: 0 });

    // Chat
    const [messages, setMessages]   = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Playlist dialog
    const [editPlaylistOpen, setEditPlaylistOpen] = useState(false);

    // Games
    const [minigames, setMinigames]         = useState<Minigame[]>([]);
    const [activeGame, setActiveGame]       = useState<ActiveGame | null>(null);
    const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
    const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Broadcast assets
    const [broadcastAssets, setBroadcastAssets] = useState<BroadcastAsset[]>([]);

    // Right panel tab
    type RightTab = 'broadcast' | 'games' | 'goal';
    const [rightTab, setRightTab] = useState<RightTab>('broadcast');

    const currentSong = room ? room.playlist[room.playback.currentSongIndex] : null;

    // ── Load room ──
    useEffect(() => {
        getMyRoom()
            .then(r => {
                if (!r || r.status !== 'live') {
                    toast.error('No live room found');
                    navigate('/studio');
                    return;
                }
                setRoom(r);
                setStats({ listenerCount: r.listenerCount ?? 0, coinsThisSession: r.streamGoalCurrent });
                return getMinigamesForRoom(r._id);
            })
            .then(games => { if (games) setMinigames(games); })
            .catch(() => { toast.error('Failed to load room'); navigate('/studio'); })
            .finally(() => setLoading(false));

        // Load broadcast assets in parallel (non-blocking)
        listBroadcastAssets().then(setBroadcastAssets).catch(() => {});
    }, [navigate]);

    // ── Session duration ticker ──
    useEffect(() => {
        if (!room?.liveAt) return;
        const liveAt = new Date(room.liveAt).getTime();
        const tick = () => setSessionDuration(Date.now() - liveAt);
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [room?.liveAt]);

    // ── Socket ──
    useEffect(() => {
        if (!room || !clerkId) return;

        const socket = connectSocket(SOCKET_URL, {
            transports: ['websocket'],
            auth: { clerkId },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('room:join', { roomId: room._id, clerkId });
        });
        socket.on('disconnect', () => setConnected(false));

        socket.on('room:listener_joined', ({ listenerCount }: { listenerCount: number }) =>
            setStats(prev => ({ ...prev, listenerCount })));
        socket.on('room:listener_left', ({ listenerCount }: { listenerCount: number }) =>
            setStats(prev => ({ ...prev, listenerCount })));
        socket.on('room:sync_checkpoint', ({ listenerCount }: { listenerCount: number }) =>
            setStats(prev => ({ ...prev, listenerCount: listenerCount ?? prev.listenerCount })));

        socket.on('room:chat_message', (msg: ChatMessage) =>
            setMessages(prev => [...prev.slice(-199), msg]));

        socket.on('room:goal_updated', ({ streamGoalCurrent }: { streamGoalCurrent: number }) =>
            setStats(prev => ({ ...prev, coinsThisSession: streamGoalCurrent })));

        socket.on('room:game_start', (game: ActiveGame) => {
            setActiveGame(game);
            const secs = Math.ceil((new Date(game.endsAt).getTime() - Date.now()) / 1000);
            setGameSecondsLeft(secs);
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            gameTimerRef.current = setInterval(() => {
                setGameSecondsLeft(p => {
                    if (p <= 1) { clearInterval(gameTimerRef.current!); return 0; }
                    return p - 1;
                });
            }, 1000);
        });

        socket.on('room:game_result', ({ winner, participantCount }: {
            winner: { username: string; answer: string } | null; participantCount: number
        }) => {
            setActiveGame(null);
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            if (winner) toast.success(`${winner.username} won with "${winner.answer}" (${participantCount} players)`);
            else        toast.info(`Game ended — ${participantCount} players, no winner · coins refunded`);
            if (room) getMinigamesForRoom(room._id).then(setMinigames).catch(() => {});
        });

        socket.on('room:song_changed', ({ song, songIndex }: { song: Song; songIndex: number }) => {
            setRoom(prev => prev ? {
                ...prev,
                playlist: prev.playlist.map((s, i) => i === songIndex ? song : s),
                playback: { ...prev.playback, currentSongIndex: songIndex },
            } : null);
        });

        // Creator-only: server fires 15s before current track ends
        socket.on('room:song_ending_soon', () => {
            toast('Song ending in ~15s', {
                description: 'Get ready to speak or trigger a game',
                icon: '⏱️',
                duration: 8000,
            });
        });

        socket.on('room:offline', () => {
            toast.info('Room went offline');
            navigate('/studio');
        });

        return () => {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            socket.emit('room:leave', { roomId: room._id, clerkId });
            socket.disconnect();
        };
    }, [room?._id, clerkId, navigate]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSkip = useCallback(() => {
        if (!room || !socketRef.current) return;
        socketRef.current.emit('room:skip', { roomId: room._id });
    }, [room]);

    const handleSendChat = useCallback(() => {
        const msg = chatInput.trim();
        if (!msg || !room || !socketRef.current) return;
        socketRef.current.emit('room:chat', { roomId: room._id, message: msg });
        setChatInput('');
    }, [chatInput, room]);

    const handleTriggerGame = useCallback((minigameId: string) => {
        if (!room || !socketRef.current) return;
        socketRef.current.emit('room:game_trigger', { roomId: room._id, minigameId });
    }, [room]);

    const handleGoOffline = async () => {
        if (!room) return;
        setToggling(true);
        try {
            await goOffline(room._id);
            navigate('/studio');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to go offline');
            setToggling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="size-7 text-zinc-400 animate-spin" />
            </div>
        );
    }

    if (!room) return null;

    return (
        <div className="flex flex-col gap-0 text-white min-h-full">

            {/* ── Top bar ── */}
            <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm px-5 py-3 flex items-center gap-3 rounded-t-2xl">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5 flex-shrink-0">
                        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                    </span>
                    <p className="font-semibold text-white truncate text-sm">{room.title}</p>
                    {!connected && <span className="text-xs text-zinc-500 flex-shrink-0">Connecting…</span>}
                </div>

                <div className="hidden md:flex items-center gap-2">
                    <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
                    <StatBadge icon={Gem}   value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
                    <StatBadge icon={Clock} value={fmtDuration(sessionDuration)} label="live time" color="text-indigo-400" />
                </div>

                <button
                    onClick={handleGoOffline}
                    disabled={toggling}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors flex-shrink-0"
                >
                    {toggling ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
                    Go Offline
                </button>
            </div>

            {/* ── 3-column body ── */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10">

                {/* ─── LEFT: Playlist ─── */}
                <div className="flex flex-col p-5 gap-4 overflow-y-auto">
                    <div className="flex items-center justify-between flex-shrink-0">
                        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playlist</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setEditPlaylistOpen(true)}
                                className="text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={!connected}
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
                            >
                                <SkipForward className="size-3.5" /> Skip
                            </button>
                        </div>
                    </div>

                    {/* Current song card */}
                    {currentSong && (
                        <div className="flex items-center gap-3 bg-white/8 border border-white/15 rounded-xl px-3 py-3 flex-shrink-0">
                            <div className="relative flex-shrink-0">
                                <img src={currentSong.imageUrl} alt={currentSong.title} className="size-12 rounded-lg object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="size-2.5 rounded-full bg-white/80 animate-pulse" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
                                <p className="text-xs text-zinc-400 truncate">{currentSong.artist}</p>
                                <p className="text-[10px] text-violet-400 mt-0.5">Now playing</p>
                            </div>
                        </div>
                    )}

                    {/* Up next */}
                    <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Up next</p>
                        {room.playlist
                            .slice(room.playback.currentSongIndex + 1, room.playback.currentSongIndex + 10)
                            .map((song, i) => (
                                <div
                                    key={`upcoming-${room.playback.currentSongIndex + 1 + i}-${song._id}`}
                                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                                >
                                    <span className="text-[10px] text-zinc-600 w-4 text-right flex-shrink-0">
                                        {room.playback.currentSongIndex + 2 + i}
                                    </span>
                                    <img src={song.imageUrl} alt={song.title} className="size-8 rounded-md object-cover flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate transition-colors">{song.title}</p>
                                        <p className="text-[10px] text-zinc-600 truncate">{song.artist}</p>
                                    </div>
                                </div>
                            ))}
                        {room.playlist.length <= room.playback.currentSongIndex + 1 && (
                            <p className="text-xs text-zinc-600 px-2 py-4">End of playlist — random next</p>
                        )}
                    </div>
                </div>

                {/* ─── CENTER: Chat ─── */}
                <div className="flex flex-col p-5 gap-3 overflow-hidden">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex-shrink-0">
                        Live Chat
                    </h2>

                    {/* Mobile stats */}
                    <div className="flex md:hidden items-center gap-2 flex-shrink-0 flex-wrap">
                        <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
                        <StatBadge icon={Gem}   value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                        {messages.length === 0 && (
                            <p className="text-zinc-600 text-xs text-center pt-8">Chat will appear here</p>
                        )}
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={cn('px-3 py-2 rounded-xl', msg.isSystem ? 'bg-white/3 text-zinc-500' : 'bg-white/5')}
                            >
                                {!msg.isSystem && (
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {msg.user.imageUrl && (
                                            <img src={msg.user.imageUrl} className="size-4 rounded-full" alt="" />
                                        )}
                                        <span className="text-xs font-semibold text-violet-400">{msg.user.username}</span>
                                        {msg.user.id === room.creatorId && (
                                            <Crown className="size-3 text-yellow-400" />
                                        )}
                                    </div>
                                )}
                                <p className="text-sm text-zinc-200 break-words">{msg.message}</p>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="flex gap-2 flex-shrink-0">
                        <Input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); }
                            }}
                            placeholder="Say something…"
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 flex-1"
                        />
                        <button
                            onClick={handleSendChat}
                            disabled={!chatInput.trim()}
                            className="p-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/10 rounded-xl transition-colors"
                        >
                            <Send className="size-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* ─── RIGHT: Tabbed Controls ─── */}
                <div className="flex flex-col overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-white/10 flex-shrink-0">
                        {([
                            { id: 'broadcast' as const, icon: Mic,      label: 'Broadcast' },
                            { id: 'games'     as const, icon: Gamepad2, label: 'Games'     },
                            { id: 'goal'      as const, icon: Coins,    label: 'Goal & Tips'},
                        ]).map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => setRightTab(id)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                                    rightTab === id
                                        ? 'text-white border-violet-500 bg-white/5'
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5'
                                }`}
                            >
                                <Icon className="size-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                        {rightTab === 'broadcast' && (
                            <BroadcastPanel
                                socket={socketRef.current}
                                roomId={room._id}
                                assets={broadcastAssets}
                                connected={connected}
                            />
                        )}
                        {rightTab === 'games' && (
                            <MinigamePanel
                                roomId={room._id}
                                creatorBalance={creatorBalance}
                                minigames={minigames}
                                activeGame={activeGame}
                                gameSecondsLeft={gameSecondsLeft}
                                onTrigger={handleTriggerGame}
                                onGameAdded={game => setMinigames(prev => [...prev, game])}
                            />
                        )}
                        {rightTab === 'goal' && (
                            <div className="space-y-5">
                                <StreamGoalPanel
                                    roomId={room._id}
                                    streamGoal={room.streamGoal}
                                    streamGoalCurrent={stats.coinsThisSession}
                                    onGoalChanged={newGoal => setRoom(prev => prev ? { ...prev, streamGoal: newGoal } : null)}
                                />
                                <DonationFeed socket={socketRef.current} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            {editPlaylistOpen && (
                <EditPlaylistDialog
                    open={editPlaylistOpen}
                    onOpenChange={setEditPlaylistOpen}
                    room={room}
                    onSaved={(newPlaylist: Song[]) => setRoom(prev => prev ? { ...prev, playlist: newPlaylist } : null)}
                />
            )}
        </div>
    );
};

export default CreatorLivePage;
