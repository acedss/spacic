// Creator Live Page — full-screen view for creator while their room is active.
// Listeners see /rooms/:id — this page is only for the creator.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { io as connectSocket, Socket } from 'socket.io-client';
import {
    Radio, Users, Gem, Loader2, SkipForward, Gamepad2,
    Send, Crown, Clock, Play,
} from 'lucide-react';
import { getMyRoom, goOffline } from '@/lib/roomService';
import { getMinigamesForRoom } from '@/lib/minigameService';
import type { RoomInfo, ChatMessage, Minigame, ActiveGame } from '@/types/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveStats {
    listenerCount:    number;
    coinsThisSession: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatBadge = ({ icon: Icon, value, label, color }: { icon: React.ElementType; value: string | number; label: string; color: string }) => (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-w-[120px]">
        <Icon className={cn('size-5 flex-shrink-0', color)} />
        <div>
            <p className="text-base font-bold text-white tabular-nums">{value}</p>
            <p className="text-[10px] text-zinc-500">{label}</p>
        </div>
    </div>
);

const GAME_TYPE_LABELS: Record<string, string> = {
    song_guesser: 'Song Guesser',
    lyric_fill:   'Lyric Fill-in',
    trivia:       'Trivia',
    skip_battle:  'Skip Battle',
};

// ── Page ──────────────────────────────────────────────────────────────────────

const CreatorLivePage = () => {
    const navigate = useNavigate();
    const { userId: clerkId } = useAuth();

    const [room, setRoom]         = useState<RoomInfo | null>(null);
    const [loading, setLoading]   = useState(true);
    const [toggling, setToggling] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0); // ms since liveAt

    // Socket state
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<LiveStats>({ listenerCount: 0, coinsThisSession: 0 });

    // Chat
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Playlist + current song
    const currentSong = room ? room.playlist[room.playback.currentSongIndex] : null;

    // Games
    const [minigames, setMinigames] = useState<Minigame[]>([]);
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
    const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
    const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
                setStats(prev => ({ ...prev, listenerCount: r.listenerCount ?? 0, coinsThisSession: r.streamGoalCurrent }));
                return getMinigamesForRoom(r._id);
            })
            .then(games => { if (games) setMinigames(games); })
            .catch(() => { toast.error('Failed to load room'); navigate('/studio'); })
            .finally(() => setLoading(false));
    }, [navigate]);

    // ── Session duration timer ──
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
            // Join as creator (using same join event — server will detect creator role)
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
                setGameSecondsLeft(p => { if (p <= 1) { clearInterval(gameTimerRef.current!); return 0; } return p - 1; });
            }, 1000);
        });

        socket.on('room:game_progress', ({ participantCount }: { participantCount: number }) => {
            setActiveGame(prev => prev ? { ...prev } : null);
            // Just a count update — no extra state needed for creator view
            void participantCount;
        });

        socket.on('room:game_result', ({ winner, participantCount }: { winner: { username: string; answer: string } | null; participantCount: number }) => {
            setActiveGame(null);
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            if (winner) toast.success(`${winner.username} won with: "${winner.answer}" (${participantCount} participants)`);
            else toast.info(`Game ended — ${participantCount} participants, no winner`);
            // Refresh minigame list to show updated statuses
            if (room) getMinigamesForRoom(room._id).then(setMinigames).catch(() => {});
        });

        socket.on('room:offline', () => {
            toast.info('Room went offline');
            navigate('/studio');
        });

        socket.on('room:song_changed', ({ song, songIndex }: { song: RoomInfo['playlist'][number]; songIndex: number }) => {
            setRoom(prev => prev ? {
                ...prev,
                playlist: prev.playlist.map((s, i) => i === songIndex && !prev.playlist[songIndex] ? song : s),
                playback: { ...prev.playback, currentSongIndex: songIndex },
            } : null);
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
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="size-8 text-zinc-400 animate-spin" />
            </div>
        );
    }

    if (!room) return null;

    const scheduledGames = minigames.filter(g => g.status === 'draft' || g.status === 'scheduled');

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

            {/* ── Top bar ── */}
            <div className="border-b border-white/10 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-20 px-6 py-3 flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
                        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                    </span>
                    <p className="font-semibold text-white truncate">{room.title}</p>
                    {!connected && <span className="text-xs text-zinc-500">Connecting…</span>}
                </div>

                {/* Live stats strip */}
                <div className="hidden md:flex items-center gap-2">
                    <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
                    <StatBadge icon={Gem}   value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
                    <StatBadge icon={Clock} value={fmtDuration(sessionDuration)} label="live time" color="text-indigo-400" />
                </div>

                <button onClick={handleGoOffline} disabled={toggling}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors flex-shrink-0">
                    {toggling ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                    Go Offline
                </button>
            </div>

            {/* ── 3-column body ── */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10 overflow-hidden" style={{ minHeight: 'calc(100vh - 65px)' }}>

                {/* ── LEFT: Playlist ── */}
                <div className="flex flex-col p-5 gap-4 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playlist</h2>
                        <button onClick={handleSkip}
                            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition-colors">
                            <SkipForward className="size-3.5" /> Skip
                        </button>
                    </div>

                    {/* Current song */}
                    {currentSong && (
                        <div className="flex items-center gap-3 bg-white/8 border border-white/15 rounded-xl px-3 py-3">
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
                    <div className="space-y-1">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Up next</p>
                        {room.playlist.slice(room.playback.currentSongIndex + 1, room.playback.currentSongIndex + 8).map((song, i) => (
                            <div key={song._id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                                <span className="text-[10px] text-zinc-600 w-4 text-right flex-shrink-0">{room.playback.currentSongIndex + 1 + i + 1}</span>
                                <img src={song.imageUrl} alt={song.title} className="size-8 rounded-md object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate transition-colors">{song.title}</p>
                                    <p className="text-[10px] text-zinc-600 truncate">{song.artist}</p>
                                </div>
                            </div>
                        ))}
                        {room.playlist.length <= room.playback.currentSongIndex + 1 && (
                            <p className="text-xs text-zinc-600 px-2 py-4">End of playlist — random song next</p>
                        )}
                    </div>
                </div>

                {/* ── CENTER: Chat ── */}
                <div className="flex flex-col p-5 gap-3 overflow-hidden">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex-shrink-0">Chat</h2>

                    {/* Mobile stats */}
                    <div className="flex md:hidden items-center gap-2 flex-shrink-0">
                        <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
                        <StatBadge icon={Gem}   value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                        {messages.length === 0 && (
                            <p className="text-zinc-600 text-xs text-center pt-8">Chat will appear here</p>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={cn('px-3 py-2 rounded-xl', msg.isSystem ? 'bg-white/3 text-zinc-500' : 'bg-white/5')}>
                                {!msg.isSystem && (
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {msg.user.imageUrl && <img src={msg.user.imageUrl} className="size-4 rounded-full" alt="" />}
                                        <span className="text-xs font-semibold text-violet-400">{msg.user.username}</span>
                                        {msg.user.id === room.creatorId && <Crown className="size-3 text-yellow-400" />}
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
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                            placeholder="Say something…"
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 flex-1"
                        />
                        <button onClick={handleSendChat} disabled={!chatInput.trim()}
                            className="p-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/10 rounded-xl transition-colors">
                            <Send className="size-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: Games ── */}
                <div className="flex flex-col p-5 gap-4 overflow-y-auto">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Minigames</h2>

                    {/* Active game display */}
                    {activeGame && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2 animate-pulse-once">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-red-300">{GAME_TYPE_LABELS[activeGame.type] ?? activeGame.type}</p>
                                <span className="text-sm font-bold text-white tabular-nums">{gameSecondsLeft}s</span>
                            </div>
                            <p className="text-xs text-white">{activeGame.title}</p>
                            {activeGame.config.question && <p className="text-xs text-zinc-300">{activeGame.config.question}</p>}
                            {activeGame.config.lyric && <p className="text-xs text-zinc-300 italic">"{activeGame.config.lyric}"</p>}
                            {activeGame.coinReward > 0 && <p className="text-xs text-yellow-400">{activeGame.coinReward} coins for winner</p>}
                            {/* Progress bar */}
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${(gameSecondsLeft / activeGame.durationSeconds) * 100}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Quick-trigger: draft/scheduled games */}
                    {scheduledGames.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Quick trigger</p>
                            {scheduledGames.map(g => (
                                <div key={g._id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white truncate">{g.title}</p>
                                        <p className="text-[10px] text-zinc-500">{GAME_TYPE_LABELS[g.type]} · {g.durationSeconds}s</p>
                                    </div>
                                    <button
                                        onClick={() => handleTriggerGame(g._id)}
                                        disabled={!!activeGame}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-xs text-white transition-colors">
                                        <Play className="size-3" /> Go
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create new game shortcut */}
                    <button onClick={() => navigate('/studio?tab=minigames')}
                        className="flex items-center gap-2 px-3 py-2 border border-dashed border-white/15 hover:border-white/25 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full">
                        <Gamepad2 className="size-4" /> Add a game in Studio
                    </button>

                    {scheduledGames.length === 0 && !activeGame && (
                        <p className="text-xs text-zinc-600 text-center py-4">No games scheduled</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreatorLivePage;
