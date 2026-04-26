// Creator Live Page — monitoring dashboard while room is broadcasting.
// Rendered inside MainLayout so left sidebar + playback footer are available.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { io as connectSocket, Socket } from 'socket.io-client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getMyRoom, goOffline } from '@/lib/roomService';
import { getMinigamesForRoom } from '@/lib/minigameService';
import { listBroadcastAssets } from '@/lib/broadcastService';
import type { RoomInfo, ChatMessage, Minigame, ActiveGame, Song, BroadcastAsset } from '@/types/types';
import { useWalletStore } from '@/stores/useWalletStore';
import { EditPlaylistDialog } from './components/EditPlaylistDialog';
import { LiveTopBar } from './components/LiveTopBar';
import { LivePlaylistColumn } from './components/LivePlaylistColumn';
import { LiveChatColumn } from './components/LiveChatColumn';
import { LiveControlsColumn } from './components/LiveControlsColumn';
import type { LiveStats, RightTab } from './components/live-shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

const CreatorLivePage = () => {
    const navigate = useNavigate();
    const { userId: clerkId } = useAuth();
    const { balance: creatorBalance } = useWalletStore();

    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0);

    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocketState] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<LiveStats>({ listenerCount: 0, coinsThisSession: 0 });

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');

    const [editPlaylistOpen, setEditPlaylistOpen] = useState(false);

    const [minigames, setMinigames] = useState<Minigame[]>([]);
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
    const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
    const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [broadcastAssets, setBroadcastAssets] = useState<BroadcastAsset[]>([]);
    const [rightTab, setRightTab] = useState<RightTab>('broadcast');

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

        listBroadcastAssets().then(setBroadcastAssets).catch(() => {});
    }, [navigate]);

    useEffect(() => {
        if (!room?.liveAt) return;
        const liveAt = new Date(room.liveAt).getTime();
        const tick = () => setSessionDuration(Date.now() - liveAt);
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [room?.liveAt]);

    useEffect(() => {
        if (!room || !clerkId) return;

        const socket = connectSocket(SOCKET_URL, {
            transports: ['websocket'],
            auth: { clerkId },
        });
        socketRef.current = socket;
        setSocketState(socket);

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
            else toast.info(`Game ended — ${participantCount} players, no winner · coins refunded`);
            if (room) getMinigamesForRoom(room._id).then(setMinigames).catch(() => {});
        });

        socket.on('room:song_changed', ({ song, songIndex }: { song: Song; songIndex: number }) => {
            setRoom(prev => prev ? {
                ...prev,
                playlist: prev.playlist.map((s, i) => i === songIndex ? song : s),
                playback: { ...prev.playback, currentSongIndex: songIndex },
            } : null);
        });

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
            <LiveTopBar
                title={room.title}
                connected={connected}
                stats={stats}
                sessionDuration={sessionDuration}
                toggling={toggling}
                onGoOffline={handleGoOffline}
            />

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                <LivePlaylistColumn
                    room={room}
                    connected={connected}
                    onEdit={() => setEditPlaylistOpen(true)}
                    onSkip={handleSkip}
                />

                <LiveChatColumn
                    messages={messages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    onSend={handleSendChat}
                    creatorId={room.creatorId}
                    stats={stats}
                />

                <LiveControlsColumn
                    tab={rightTab}
                    setTab={setRightTab}
                    socket={socket}
                    connected={connected}
                    roomId={room._id}
                    streamGoal={room.streamGoal}
                    coinsThisSession={stats.coinsThisSession}
                    onGoalChanged={newGoal => setRoom(prev => prev ? { ...prev, streamGoal: newGoal } : null)}
                    creatorBalance={creatorBalance}
                    minigames={minigames}
                    activeGame={activeGame}
                    gameSecondsLeft={gameSecondsLeft}
                    onTriggerGame={handleTriggerGame}
                    onGameAdded={game => setMinigames(prev => [...prev, game])}
                    broadcastAssets={broadcastAssets}
                />
            </div>

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
