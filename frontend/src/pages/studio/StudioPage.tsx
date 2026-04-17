import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Save, Loader2,
    ListMusic, Gamepad2, Settings, BarChart3, Trash2, Play, Radio, Plus,
} from 'lucide-react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
    Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs, getCreatorRoomAnalytics } from '@/lib/roomService';
import { getMyPlaylists, createPlaylist, deletePlaylist } from '@/lib/playlistService';
import { getMinigamesForRoom, createMinigame, deleteMinigame } from '@/lib/minigameService';
import type {
    CreatorRoomAnalytics, RoomInfo, RoomSession, Song,
    SavedPlaylist, Minigame, MinigameType, MinigameTriggerType,
} from '@/types/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { StatsStrip } from './components/StatsStrip';
import { ChartShell } from './components/ChartShell';
import { SongSelector } from './components/SongSelector';
import { GoLiveDialog } from './components/GoLiveDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
type AnalyticsGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';
const CHART_AXIS    = { fontSize: 10, fill: '#71717a' };
const CHART_GRID    = '#27272a';
const CHART_TOOLTIP = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 };
const CHART_COLORS  = ['#a78bfa','#34d399','#f59e0b','#60a5fa','#f472b6','#22d3ee','#fb7185','#a3e635'];
const toDateTimeInputValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const toDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const fmtDateShort = (v: string) => { const d = toDate(v); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : v; };
const fmtDateLong  = (v: string) => { const d = toDate(v); return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : v; };
const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));

type Tab = 'overview' | 'playlists' | 'minigames' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  icon: BarChart3  },
    { id: 'playlists', label: 'Playlists', icon: ListMusic  },
    { id: 'minigames', label: 'Minigames', icon: Gamepad2   },
    { id: 'settings',  label: 'Settings',  icon: Settings   },
];

// ── Minigame type meta ────────────────────────────────────────────────────────

const GAME_TYPES: { value: MinigameType; label: string; desc: string }[] = [
    { value: 'song_guesser', label: 'Song Guesser',  desc: 'First to type the song title wins' },
    { value: 'lyric_fill',   label: 'Lyric Fill-in', desc: 'Complete the missing lyric' },
    { value: 'trivia',       label: 'Trivia',         desc: 'Multiple-choice question, timed' },
    { value: 'skip_battle',  label: 'Skip Battle',    desc: 'Vote duel — keep or skip current song' },
];
const TRIGGER_TYPES: { value: MinigameTriggerType; label: string }[] = [
    { value: 'manual',      label: 'Manual (trigger from Live page)' },
    { value: 'before_song', label: 'Before song at index…' },
    { value: 'after_song',  label: 'After song at index…' },
];
const STATUS_COLORS: Record<string, string> = {
    draft:     'bg-zinc-700 text-zinc-300',
    scheduled: 'bg-blue-900/50 text-blue-300',
    active:    'bg-red-900/50 text-red-300',
    completed: 'bg-emerald-900/50 text-emerald-300',
    cancelled: 'bg-zinc-800 text-zinc-500',
};

// ── Page ──────────────────────────────────────────────────────────────────────

const StudioPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // ── Room / songs ──
    const [room, setRoom] = useState<RoomInfo | null | undefined>(undefined);
    const [songs, setSongs] = useState<Song[]>([]);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [goLiveDialogOpen, setGoLiveDialogOpen] = useState(false);
    const [songsLoading, setSongsLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [streamGoal, setStreamGoal] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // ── Analytics ──
    const [analytics, setAnalytics] = useState<CreatorRoomAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsGranularity, setAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);
    const [initialRange] = useState(() => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86_400_000);
        return { from: toDateTimeInputValue(from), to: toDateTimeInputValue(to) };
    });
    const [analyticsFrom, setAnalyticsFrom] = useState(initialRange.from);
    const [analyticsTo, setAnalyticsTo] = useState(initialRange.to);
    const [appliedAnalyticsGranularity, setAppliedAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [appliedAnalyticsFrom, setAppliedAnalyticsFrom] = useState(initialRange.from);
    const [appliedAnalyticsTo, setAppliedAnalyticsTo] = useState(initialRange.to);

    // ── Playlists tab ──
    const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistSongs, setNewPlaylistSongs] = useState<string[]>([]);
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [showPlaylistForm, setShowPlaylistForm] = useState(false);

    // ── Minigames tab ──
    const [minigames, setMinigames] = useState<Minigame[]>([]);
    const [minigamesLoading, setMinigamesLoading] = useState(false);
    const [showMinigameForm, setShowMinigameForm] = useState(false);
    const [gameType, setGameType] = useState<MinigameType>('song_guesser');
    const [gameTitle, setGameTitle] = useState('');
    const [gameTrigger, setGameTrigger] = useState<MinigameTriggerType>('manual');
    const [gameSongIndex, setGameSongIndex] = useState('');
    const [gameDuration, setGameDuration] = useState('30');
    const [gameCoinReward, setGameCoinReward] = useState('0');
    const [gameQuestion, setGameQuestion] = useState('');
    const [gameAnswer, setGameAnswer] = useState('');
    const [gameLyric, setGameLyric] = useState('');
    const [gameOptions, setGameOptions] = useState(['', '', '', '']);
    const [gameCorrectOption, setGameCorrectOption] = useState(0);
    const [savingGame, setSavingGame] = useState(false);

    // ── Data loading ──
    useEffect(() => {
        Promise.all([getMyRoom(), getSongs(true)])
            .then(([myRoom, rawSongs]) => {
                const allSongs = rawSongs.filter((s, i, arr) => arr.findIndex(x => x._id === s._id) === i);
                setRoom(myRoom);
                setSongs(allSongs);
                setSongsLoading(false);
                if (myRoom) {
                    setTitle(myRoom.title);
                    setDescription(myRoom.description ?? '');
                    setIsPublic(myRoom.isPublic);
                    setStreamGoal(myRoom.streamGoal > 0 ? String(myRoom.streamGoal) : '');
                    setSelectedIds(myRoom.playlist.map(s => s._id));
                }
            })
            .catch(() => { setError('Failed to load room data'); setSongsLoading(false); });
    }, []);

    useEffect(() => {
        let cancelled = false;
        setAnalyticsLoading(true);
        const load = async () => {
            try {
                const data = await getCreatorRoomAnalytics({
                    granularity: appliedAnalyticsGranularity,
                    from: toDate(appliedAnalyticsFrom)?.toISOString(),
                    to: toDate(appliedAnalyticsTo)?.toISOString(),
                });
                if (!cancelled) setAnalytics(data);
            } catch { if (!cancelled) toast.error('Failed to load analytics'); }
            finally { if (!cancelled) setAnalyticsLoading(false); }
        };
        void load();
        return () => { cancelled = true; };
    }, [appliedAnalyticsGranularity, appliedAnalyticsFrom, appliedAnalyticsTo, analyticsRefreshTick]);

    // Load playlists when tab opens
    useEffect(() => {
        if (activeTab !== 'playlists') return;
        setPlaylistsLoading(true);
        getMyPlaylists()
            .then(setPlaylists)
            .catch(() => toast.error('Failed to load playlists'))
            .finally(() => setPlaylistsLoading(false));
    }, [activeTab]);

    // Load minigames when tab opens and room is ready
    useEffect(() => {
        if (activeTab !== 'minigames' || !room?._id) return;
        setMinigamesLoading(true);
        getMinigamesForRoom(room._id)
            .then(setMinigames)
            .catch(() => toast.error('Failed to load minigames'))
            .finally(() => setMinigamesLoading(false));
    }, [activeTab, room?._id]);

    const applyAnalyticsRange = () => {
        const fromDate = toDate(analyticsFrom);
        const toDateValue = toDate(analyticsTo);
        if (!fromDate || !toDateValue) return toast.error('Invalid date range');
        if (fromDate >= toDateValue) return toast.error('From must be before To');
        setAppliedAnalyticsGranularity(analyticsGranularity);
        setAppliedAnalyticsFrom(analyticsFrom);
        setAppliedAnalyticsTo(analyticsTo);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return setError('Room name is required');
        if (selectedIds.length === 0) return setError('Select at least one song');
        setError(null);
        setSaving(true);
        try {
            const saved = await upsertRoom({ title: title.trim(), description: description.trim(), isPublic, playlistIds: selectedIds, streamGoal: streamGoal ? parseInt(streamGoal, 10) : 0 });
            setRoom(saved);
            toast.success('Room saved');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
        finally { setSaving(false); }
    };

    const handleGoLiveConfirm = useCallback(async () => {
        setGoLiveDialogOpen(false);
        if (!room) return;
        setToggling(true);
        try {
            await goLive(room._id);
            navigate('/studio/live'); // Creator goes to their own full live page, not the listener room
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to go live');
            setToggling(false);
        }
    }, [room, navigate]);

    const handleGoOffline = async () => {
        if (!room) return;
        setToggling(true);
        try {
            await goOffline(room._id);
            const refreshed = await getMyRoom();
            setRoom(refreshed);
            setAnalyticsRefreshTick(t => t + 1);
            toast.success('Room is now offline');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to go offline'); }
        finally { setToggling(false); }
    };

    // ── Playlist actions ──
    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return toast.error('Playlist name required');
        setCreatingPlaylist(true);
        try {
            const p = await createPlaylist({ name: newPlaylistName.trim(), songs: newPlaylistSongs });
            setPlaylists(prev => [p, ...prev]);
            setNewPlaylistName('');
            setNewPlaylistSongs([]);
            setShowPlaylistForm(false);
            toast.success('Playlist created');
        } catch { toast.error('Failed to create playlist'); }
        finally { setCreatingPlaylist(false); }
    };

    const handleDeletePlaylist = async (id: string) => {
        if (!confirm('Delete this playlist?')) return;
        try {
            await deletePlaylist(id);
            setPlaylists(prev => prev.filter(p => p._id !== id));
            toast.success('Playlist deleted');
        } catch { toast.error('Failed to delete playlist'); }
    };

    const loadPlaylistIntoRoom = (playlist: SavedPlaylist) => {
        setSelectedIds(playlist.songs.map(s => s._id));
        setActiveTab('settings');
        toast.success(`"${playlist.name}" loaded — save to apply`);
    };

    // ── Minigame actions ──
    const buildGameConfig = () => {
        if (gameType === 'lyric_fill') return { lyric: gameLyric, answer: gameAnswer };
        if (gameType === 'trivia') return { question: gameQuestion, options: gameOptions, correctOption: gameCorrectOption };
        if (gameType === 'song_guesser') return { answer: gameAnswer };
        return {};
    };

    const handleCreateMinigame = async () => {
        if (!gameTitle.trim() || !room?._id) return;
        setSavingGame(true);
        try {
            const g = await createMinigame(room._id, {
                type: gameType,
                title: gameTitle.trim(),
                trigger: {
                    type: gameTrigger,
                    songIndex: gameTrigger !== 'manual' && gameSongIndex ? parseInt(gameSongIndex, 10) : null,
                },
                durationSeconds: parseInt(gameDuration, 10) || 30,
                coinReward: parseInt(gameCoinReward, 10) || 0,
                config: buildGameConfig(),
            });
            setMinigames(prev => [g, ...prev]);
            setShowMinigameForm(false);
            setGameTitle('');
            toast.success('Minigame saved');
        } catch { toast.error('Failed to save minigame'); }
        finally { setSavingGame(false); }
    };

    const handleDeleteMinigame = async (id: string) => {
        if (!confirm('Delete this minigame?')) return;
        try {
            await deleteMinigame(id);
            setMinigames(prev => prev.filter(g => g._id !== id));
            toast.success('Minigame deleted');
        } catch { toast.error('Failed to delete minigame'); }
    };

    // ── Derived state ──
    if (room === undefined) {
        return (
            <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
                <Skeleton className="h-7 w-40 bg-white/5" />
                <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}</div>
                <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl bg-white/5" />)}</div>
            </div>
        );
    }

    const isLive  = room?.status === 'live';
    const hasRoom = !!room;
    const sessionTrend  = sortByDateAsc(analytics?.sessionTrend  ?? []);
    const donationTrend = sortByDateAsc(analytics?.donationTrend ?? []);
    const topSongs      = analytics?.topSongs    ?? [];
    const topSessions   = analytics?.topSessions ?? [];
    const summary       = analytics?.summary ?? { sessions: 0, listeners: 0, minutesListened: 0, coinsEarned: 0, peakListeners: 0, avgListenersPerSession: 0 };

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Creator Studio</h1>
                    <p className="text-zinc-500 text-sm mt-0.5">Manage your channel</p>
                </div>
                {hasRoom && (
                    <div className="flex items-center gap-3">
                        {isLive ? (
                            <>
                                <button onClick={() => navigate('/studio/live')} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                                    <span className="size-1.5 rounded-full bg-red-400 animate-pulse" /> Live Dashboard
                                </button>
                                <button onClick={handleGoOffline} disabled={toggling}
                                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors">
                                    {toggling ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                    Go Offline
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setGoLiveDialogOpen(true)} disabled={toggling || selectedIds.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors">
                                {toggling ? <Loader2 className="size-4 animate-spin" /> : <span className="size-1.5 rounded-full bg-white animate-pulse" />}
                                Go Live
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Live banner */}
            {isLive && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-sm text-red-400 font-medium">You are live — go to your Live Dashboard to manage the session</p>
                </div>
            )}

            {/* Tab navigation */}
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === tab.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                        )}>
                        <tab.icon className="size-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && hasRoom && (
                <div className="space-y-6">
                    <StatsStrip room={room} />

                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Room Analytics</h2>
                                <p className="text-xs text-zinc-500 mt-1">Track this room by time range and granularity.</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <select value={analyticsGranularity} onChange={e => setAnalyticsGranularity(e.target.value as AnalyticsGranularity)}
                                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-zinc-300">
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <Input type="datetime-local" value={analyticsFrom} onChange={e => setAnalyticsFrom(e.target.value)} className="h-9 w-[178px] bg-white/5 border-white/10 text-xs text-zinc-300" />
                                <Input type="datetime-local" value={analyticsTo} onChange={e => setAnalyticsTo(e.target.value)} className="h-9 w-[178px] bg-white/5 border-white/10 text-xs text-zinc-300" />
                                <button type="button" onClick={applyAnalyticsRange} className="h-9 px-3 rounded-lg border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Apply</button>
                                <button type="button" onClick={() => setAnalyticsRefreshTick(t => t + 1)} className="h-9 px-3 rounded-lg border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Refresh</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-6 border border-white/10 rounded-xl overflow-hidden divide-x divide-y lg:divide-y-0 divide-white/10">
                            {[
                                { label: 'Sessions',          val: summary.sessions,               color: 'text-white' },
                                { label: 'Listeners',         val: summary.listeners,              color: 'text-violet-300' },
                                { label: 'Avg/session',       val: summary.avgListenersPerSession, color: 'text-emerald-300' },
                                { label: 'Listen time',       val: toHours(summary.minutesListened),color: 'text-sky-300', raw: true },
                                { label: 'Coins earned',      val: summary.coinsEarned,            color: 'text-yellow-300' },
                                { label: 'Peak listeners',    val: summary.peakListeners,          color: 'text-pink-300' },
                            ].map(({ label, val, color, raw }) => (
                                <div key={label} className="px-4 py-3">
                                    <p className="text-[11px] text-zinc-500">{label}</p>
                                    <p className={cn('text-lg font-semibold', color)}>{raw ? val : typeof val === 'number' ? val.toLocaleString() : val}</p>
                                </div>
                            ))}
                        </div>

                        {analyticsLoading ? (
                            <div className="flex items-center gap-2 text-zinc-400 py-5"><Loader2 className="size-4 animate-spin" /> Loading analytics…</div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <ChartShell title="Session trend">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={sessionTrend}>
                                            <defs>
                                                <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                                                <linearGradient id="gListeners" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                            <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis yAxisId="s" tick={CHART_AXIS} allowDecimals={false} />
                                            <YAxis yAxisId="l" orientation="right" tick={CHART_AXIS} allowDecimals={false} />
                                            <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={v => fmtDateLong(String(v))} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                            <Area yAxisId="s" type="monotone" dataKey="sessions" name="Sessions" stroke="#a78bfa" fill="url(#gSessions)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="l" type="monotone" dataKey="listeners" name="Listeners" stroke="#34d399" fill="url(#gListeners)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </ChartShell>
                                <ChartShell title="Donation trend">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={donationTrend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                                            <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis tick={CHART_AXIS} />
                                            <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={v => fmtDateLong(String(v))} />
                                            <Bar dataKey="amount" name="Donations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartShell>
                                <ChartShell title="Top songs">
                                    {topSongs.length === 0 ? <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No data</div> : (
                                        <ResponsiveContainer width="100%" height={Math.max(180, Math.min(10, topSongs.length) * 30)}>
                                            <BarChart data={topSongs.slice(0, 10)} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                                                <XAxis type="number" tick={CHART_AXIS} allowDecimals={false} />
                                                <YAxis type="category" dataKey="title" width={130} tick={{ ...CHART_AXIS, fontSize: 11 }} tickFormatter={v => String(v).length > 20 ? `${String(v).slice(0, 20)}…` : String(v)} />
                                                <Tooltip contentStyle={CHART_TOOLTIP} />
                                                <Bar dataKey="streams" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartShell>
                                <ChartShell title="Stream share">
                                    {topSongs.length === 0 ? <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No data</div> : (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie data={topSongs.slice(0, 8)} dataKey="streams" nameKey="title" outerRadius={78} innerRadius={42} paddingAngle={2}>
                                                    {topSongs.slice(0, 8).map((e, idx) => <Cell key={e.songId} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={CHART_TOOLTIP} />
                                                <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartShell>
                                <ChartShell title="Top sessions">
                                    {topSessions.length === 0 ? <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No sessions</div> : (
                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                            {topSessions.map((s, i) => (
                                                <div key={i} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs text-zinc-400">{fmtDateLong(s.startedAt)}</p>
                                                        <p className="text-xs text-zinc-600">{s.endedAt ? fmtDateLong(s.endedAt) : 'Live'}</p>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                                                        <div><p className="text-sm font-semibold text-white">{s.listenerCount}</p><p className="text-[10px] text-zinc-500">listeners</p></div>
                                                        <div><p className="text-sm font-semibold text-emerald-300">{toHours(s.minutesListened)}</p><p className="text-[10px] text-zinc-500">listened</p></div>
                                                        <div><p className="text-sm font-semibold text-yellow-300">{s.coinsEarned.toLocaleString()}</p><p className="text-[10px] text-zinc-500">coins</p></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ChartShell>
                            </div>
                        )}
                    </section>

                    {/* Recent sessions quick list */}
                    {room.sessions && room.sessions.length > 0 && (
                        <div className="border-t border-white/5 pt-6">
                            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent Sessions</h2>
                            <div className="space-y-2">
                                {[...room.sessions].reverse().slice(0, 5).map((sess: RoomSession, i: number) => (
                                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                                        <p className="text-xs text-zinc-500">{sess.endedAt ? new Date(sess.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>
                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-zinc-300">{sess.listenerCount} <span className="text-zinc-600 text-xs">listeners</span></span>
                                            <span className="text-zinc-300">{toHours(sess.minutesListened ?? 0)} <span className="text-zinc-600 text-xs">listened</span></span>
                                            <span className="text-yellow-400">{sess.coinsEarned?.toLocaleString()} <span className="text-zinc-600 text-xs">coins</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'overview' && !hasRoom && (
                <div className="text-center py-16 text-zinc-500">No room yet — create one in Settings</div>
            )}

            {/* ── PLAYLISTS TAB ── */}
            {activeTab === 'playlists' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Saved Playlists</h2>
                            <p className="text-xs text-zinc-500 mt-1">Build playlists once, load them into any session.</p>
                        </div>
                        <button onClick={() => setShowPlaylistForm(p => !p)}
                            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm text-white transition-colors">
                            <Plus className="size-3.5" /> New Playlist
                        </button>
                    </div>

                    {/* New playlist form */}
                    {showPlaylistForm && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white">Create Playlist</h3>
                            <Input placeholder="Playlist name" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                            <div>
                                <label className="text-xs text-zinc-500 mb-2 block">Songs</label>
                                {songsLoading ? <Skeleton className="h-48 bg-white/5" /> : (
                                    <SongSelector songs={songs} selectedIds={newPlaylistSongs} onChange={setNewPlaylistSongs} />
                                )}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowPlaylistForm(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleCreatePlaylist} disabled={creatingPlaylist || !newPlaylistName.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/10 rounded-xl text-sm text-white transition-colors">
                                    {creatingPlaylist ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Playlists grid */}
                    {playlistsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />)}
                        </div>
                    ) : playlists.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm">No playlists yet</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {playlists.map(p => (
                                <div key={p._id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-white truncate">{p.name}</p>
                                            <p className="text-xs text-zinc-500">{p.songs.length} songs</p>
                                        </div>
                                        <button onClick={() => handleDeletePlaylist(p._id)} className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                    {/* Song preview */}
                                    <div className="flex -space-x-2">
                                        {p.songs.slice(0, 5).map(s => (
                                            <img key={s._id} src={s.imageUrl} alt={s.title} title={s.title}
                                                className="size-8 rounded-md object-cover border border-black/50" />
                                        ))}
                                        {p.songs.length > 5 && <div className="size-8 rounded-md bg-white/10 border border-black/50 flex items-center justify-center text-[10px] text-zinc-400">+{p.songs.length - 5}</div>}
                                    </div>
                                    <button onClick={() => loadPlaylistIntoRoom(p)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg text-xs text-zinc-300 hover:text-white transition-colors">
                                        <Play className="size-3" /> Load into room
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── MINIGAMES TAB ── */}
            {activeTab === 'minigames' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Minigames</h2>
                            <p className="text-xs text-zinc-500 mt-1">Schedule games at song transitions or trigger manually during a live session.</p>
                        </div>
                        {hasRoom && (
                            <button onClick={() => setShowMinigameForm(p => !p)}
                                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm text-white transition-colors">
                                <Plus className="size-3.5" /> New Game
                            </button>
                        )}
                    </div>

                    {!hasRoom && <div className="text-center py-16 text-zinc-500 text-sm">Create a room first in Settings</div>}

                    {/* New game form */}
                    {showMinigameForm && hasRoom && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white">Create Minigame</h3>

                            <Input placeholder="Game title" value={gameTitle} onChange={e => setGameTitle(e.target.value)}
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />

                            {/* Type picker */}
                            <div className="grid grid-cols-2 gap-2">
                                {GAME_TYPES.map(gt => (
                                    <button key={gt.value} onClick={() => setGameType(gt.value)}
                                        className={cn('p-3 rounded-xl border text-left transition-all', gameType === gt.value ? 'border-violet-500/50 bg-violet-500/10 text-white' : 'border-white/10 bg-white/3 text-zinc-400 hover:border-white/20')}>
                                        <p className="text-sm font-medium">{gt.label}</p>
                                        <p className="text-xs mt-0.5 opacity-70">{gt.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Type-specific config */}
                            {gameType === 'song_guesser' && (
                                <Input placeholder="Correct song title (case-insensitive)" value={gameAnswer} onChange={e => setGameAnswer(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                            )}
                            {gameType === 'lyric_fill' && (
                                <div className="space-y-2">
                                    <Input placeholder='Lyric with blank e.g. "Never gonna give you ___"' value={gameLyric} onChange={e => setGameLyric(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                                    <Input placeholder="Correct answer" value={gameAnswer} onChange={e => setGameAnswer(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                                </div>
                            )}
                            {gameType === 'trivia' && (
                                <div className="space-y-2">
                                    <Input placeholder="Question" value={gameQuestion} onChange={e => setGameQuestion(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                                    {gameOptions.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <button onClick={() => setGameCorrectOption(i)}
                                                className={cn('size-5 rounded-full border-2 flex-shrink-0 transition-colors', gameCorrectOption === i ? 'border-emerald-400 bg-emerald-400' : 'border-white/20')}>
                                            </button>
                                            <Input placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                                                onChange={e => setGameOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 flex-1" />
                                        </div>
                                    ))}
                                    <p className="text-xs text-zinc-500">Circle = correct answer</p>
                                </div>
                            )}

                            {/* Trigger */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1.5 block">Trigger</label>
                                    <select value={gameTrigger} onChange={e => setGameTrigger(e.target.value as MinigameTriggerType)}
                                        className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-zinc-300">
                                        {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                {gameTrigger !== 'manual' && (
                                    <div>
                                        <label className="text-xs text-zinc-500 mb-1.5 block">Song index (0-based)</label>
                                        <Input type="number" min="0" placeholder="e.g. 2" value={gameSongIndex} onChange={e => setGameSongIndex(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9" />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1.5 block">Duration (sec)</label>
                                    <Input type="number" min="10" max="120" value={gameDuration} onChange={e => setGameDuration(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9" />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1.5 block">Coin reward (winner)</label>
                                    <Input type="number" min="0" value={gameCoinReward} onChange={e => setGameCoinReward(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9" />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowMinigameForm(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleCreateMinigame} disabled={savingGame || !gameTitle.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-sm text-white transition-colors">
                                    {savingGame ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Game
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Minigames list */}
                    {minigamesLoading ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}</div>
                    ) : minigames.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm">No minigames yet</div>
                    ) : (
                        <div className="space-y-2">
                            {minigames.map(g => (
                                <div key={g._id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-white">{g.title}</p>
                                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[g.status] ?? '')}>{g.status}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {GAME_TYPES.find(t => t.value === g.type)?.label} ·{' '}
                                            {g.trigger.type === 'manual' ? 'Manual trigger' : `${g.trigger.type.replace('_', ' ')} song ${g.trigger.songIndex}`} ·{' '}
                                            {g.durationSeconds}s · {g.coinReward > 0 ? `${g.coinReward} coins` : 'No reward'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => handleDeleteMinigame(g._id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {isLive && (
                        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                            <Gamepad2 className="size-4 text-blue-400" />
                            <p className="text-sm text-blue-300">You're live — trigger games from the <button onClick={() => navigate('/studio/live')} className="underline hover:text-white">Live Dashboard</button></p>
                        </div>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === 'settings' && (
                <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Channel name</label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} disabled={isLive} placeholder="e.g. Late Night Vibes"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={isLive} rows={2} placeholder="What kind of music do you play?"
                                className="w-full bg-white/5 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 placeholder:text-zinc-600 resize-none text-sm border border-white/10" />
                        </div>
                        <div className="flex items-center justify-between py-1">
                            <div>
                                <p className="text-sm text-zinc-300">Public channel</p>
                                <p className="text-xs text-zinc-600">Visible on discovery when live</p>
                            </div>
                            <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLive} />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Stream goal <span className="text-zinc-600">(coins, optional)</span></label>
                            <Input type="number" min="1" step="1" value={streamGoal} onChange={e => setStreamGoal(e.target.value)} disabled={isLive} placeholder="e.g. 1000"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-zinc-600 focus-visible:ring-white/20" />
                            <p className="text-xs text-zinc-600 mt-1">Resets on each go-live.</p>
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Playlist</label>
                            <p className="text-xs text-zinc-600 mb-2">Or load from the <button type="button" onClick={() => setActiveTab('playlists')} className="text-violet-400 hover:text-violet-300 transition-colors">Playlists tab</button></p>
                            {songsLoading ? <Skeleton className="h-48 bg-white/5 rounded-xl" /> : (
                                <SongSelector songs={songs} selectedIds={selectedIds} onChange={setSelectedIds} disabled={isLive} />
                            )}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    {!isLive && (
                        <button type="submit" disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {hasRoom ? 'Save Changes' : 'Create Channel'}
                        </button>
                    )}
                </form>
            )}

            <GoLiveDialog open={goLiveDialogOpen} onCancel={() => setGoLiveDialogOpen(false)} onConfirm={handleGoLiveConfirm} />
        </div>
    );
};

export default StudioPage;
