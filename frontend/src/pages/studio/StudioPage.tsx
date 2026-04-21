import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Save, Loader2,
    ListMusic, Gamepad2, Settings, BarChart3, Trash2, Play, Radio, Plus, Mic,
    Tag, Zap, Upload, X, ImageIcon,
} from 'lucide-react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
    Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs, getCreatorRoomAnalytics, uploadCoverImage } from '@/lib/roomService';
import { getMyPlaylists, createPlaylist, deletePlaylist } from '@/lib/playlistService';
import { getMinigamesForRoom, createMinigame, deleteMinigame } from '@/lib/minigameService';
import { listBroadcastAssets, updateFeatureFlags } from '@/lib/broadcastService';
import type {
    CreatorRoomAnalytics, RoomInfo, RoomSession, Song,
    SavedPlaylist, Minigame, MinigameType, MinigameTriggerType, BroadcastAsset, RoomFeatureFlags,
} from '@/types/types';
import { BroadcastAssetsTab } from './components/BroadcastAssetsTab';
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
const CHART_AXIS    = { fontSize: 10, fill: 'oklch(0.55 0.01 285)' };
const CHART_GRID    = 'oklch(0.18 0.01 285)';
const CHART_TOOLTIP = { backgroundColor: 'oklch(0.14 0.015 285)', border: '1px solid oklch(0.25 0.01 285)', borderRadius: 8, fontSize: 12 };
const CHART_COLORS  = ['#a78bfa','#34d399','#f59e0b','#60a5fa','#f472b6','#22d3ee','#fb7185','#a3e635'];
const toDateTimeInputValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const toDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const fmtDateShort = (v: string) => { const d = toDate(v); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : v; };
const fmtDateLong  = (v: string) => { const d = toDate(v); return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : v; };
const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));

const ALL_TAGS = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi', 'Pop', 'Hip-Hop', 'Classical', 'Country', 'Reggae', 'Metal'];

type Tab = 'overview' | 'playlists' | 'broadcasts' | 'minigames' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',   label: 'Overview',   icon: BarChart3  },
    { id: 'playlists',  label: 'Playlists',  icon: ListMusic  },
    { id: 'broadcasts', label: 'Broadcasts', icon: Mic        },
    { id: 'minigames',  label: 'Minigames',  icon: Gamepad2   },
    { id: 'settings',   label: 'Settings',   icon: Settings   },
];

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
    draft:     'bg-white/8 text-white/50',
    scheduled: 'bg-[oklch(0.55_0.18_250_/_0.15)] text-[oklch(0.75_0.1_250)]',
    active:    'bg-[oklch(0.72_0.22_20_/_0.12)] text-[oklch(0.82_0.17_20)]',
    completed: 'bg-[oklch(0.55_0.18_160_/_0.15)] text-[oklch(0.75_0.12_160)]',
    cancelled: 'bg-white/5 text-white/30',
};

// ── Shared UI atoms ───────────────────────────────────────────────────────────

const SectionHead = ({ label, sub }: { label: string; sub?: string }) => (
    <div>
        <p className="mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--fg-3)' }}>{label}</p>
        {sub && <p className="text-[12px]" style={{ color: 'var(--fg-2)' }}>{sub}</p>}
    </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-3)' }}>{children}</p>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('rounded-2xl ring-1 ring-white/10 p-5', className)} style={{ background: 'var(--ink-2)' }}>
        {children}
    </div>
);

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
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState(false);

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

    // ── Broadcasts tab ──
    const [broadcastAssets, setBroadcastAssets] = useState<BroadcastAsset[]>([]);
    const [broadcastsLoading, setBroadcastsLoading] = useState(false);

    // ── Feature flags (settings) ──
    const [featureFlags, setFeatureFlags] = useState<RoomFeatureFlags>({
        liveMic: true, chat: true, donations: true, voting: true,
        minigames: true, voteQueue: true, broadcasts: true,
    });
    const [savingFlags, setSavingFlags] = useState(false);

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
                    if (myRoom.featureFlags) setFeatureFlags(myRoom.featureFlags);
                    if (myRoom.tags?.length) setSelectedTags(myRoom.tags);
                    if (myRoom.coverImageUrl) setCoverImageUrl(myRoom.coverImageUrl);
                    if (myRoom.coverImageKey) setCoverImageKey(myRoom.coverImageKey);
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

    useEffect(() => {
        if (activeTab !== 'playlists') return;
        setPlaylistsLoading(true);
        getMyPlaylists()
            .then(setPlaylists)
            .catch(() => toast.error('Failed to load playlists'))
            .finally(() => setPlaylistsLoading(false));
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'broadcasts') return;
        setBroadcastsLoading(true);
        listBroadcastAssets()
            .then(setBroadcastAssets)
            .catch(() => toast.error('Failed to load broadcast assets'))
            .finally(() => setBroadcastsLoading(false));
    }, [activeTab]);

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
            const saved = await upsertRoom({
                title: title.trim(),
                description: description.trim(),
                isPublic,
                playlistIds: selectedIds,
                streamGoal: streamGoal ? parseInt(streamGoal, 10) : 0,
                tags: selectedTags,
                coverImageUrl: coverImageKey,
            });
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
            navigate('/studio/live');
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

    const handleSaveFeatureFlags = async () => {
        setSavingFlags(true);
        try {
            const updated = await updateFeatureFlags(featureFlags);
            setFeatureFlags(updated);
            toast.success('Room features saved');
        } catch { toast.error('Failed to save features'); }
        finally { setSavingFlags(false); }
    };

    const handleDeleteMinigame = async (id: string) => {
        if (!confirm('Delete this minigame?')) return;
        try {
            await deleteMinigame(id);
            setMinigames(prev => prev.filter(g => g._id !== id));
            toast.success('Minigame deleted');
        } catch { toast.error('Failed to delete minigame'); }
    };

    const toggleTag = (tag: string) => setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

    const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }

        setCoverUploading(true);
        try {
            const { key, presignedUrl } = await uploadCoverImage(file);
            setCoverImageKey(key);
            setCoverImageUrl(presignedUrl);
            toast.success('Cover image uploaded — save to apply');
        } catch {
            toast.error('Failed to upload cover image');
        } finally {
            setCoverUploading(false);
        }
    };

    // ── Loading skeleton ──
    if (room === undefined) {
        return (
            <div className="max-w-5xl mx-auto py-12 px-6 space-y-8">
                <Skeleton className="h-8 w-48 bg-white/5 rounded-xl" />
                <div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-xl bg-white/5" />)}</div>
                <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl bg-white/5" />)}</div>
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
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-7" style={{ color: 'var(--fg-1)' }}>

            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Creator Studio</p>
                    <h1 className="serif italic text-white" style={{ fontSize: 34 }}>
                        {hasRoom ? room.title : 'My Channel'}
                    </h1>
                    {hasRoom && room.status && (
                        <div className="flex items-center gap-2 mt-1.5">
                            {isLive
                                ? <><span className="live-dot" style={{ width: 6, height: 6 }} /><span className="mono text-[10px] text-[oklch(0.82_0.17_20)]">Live now · {room.listenerCount ?? 0} listening</span></>
                                : <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Offline</span>
                            }
                        </div>
                    )}
                </div>

                {hasRoom && (
                    <div className="flex items-center gap-2">
                        {isLive ? (
                            <>
                                <button onClick={() => navigate('/studio/live')}
                                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-semibold text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.12)] press">
                                    <span className="live-dot" /> Live Dashboard
                                </button>
                                <button onClick={handleGoOffline} disabled={toggling}
                                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 disabled:opacity-50 press">
                                    {toggling ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                    Go Offline
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setGoLiveDialogOpen(true)} disabled={toggling || selectedIds.length === 0}
                                className="flex items-center gap-2 h-9 px-5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 press"
                                style={{ background: 'oklch(0.72 0.22 20)' }}>
                                {toggling ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                                Go Live
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Live banner */}
            {isLive && (
                <div className="flex items-center gap-3 rounded-2xl px-5 py-3 ring-1 ring-[oklch(0.72_0.22_20_/_0.3)]"
                    style={{ background: 'oklch(0.72 0.22 20 / 0.08)' }}>
                    <span className="live-dot shrink-0" />
                    <p className="text-[13px] text-[oklch(0.82_0.17_20)]">You are live — manage the session from your Live Dashboard</p>
                    <button onClick={() => navigate('/studio/live')} className="ml-auto mono text-[10px] text-[oklch(0.82_0.17_20)] underline press">Open →</button>
                </div>
            )}

            {/* ── Tab navigation ── */}
            <div className="flex gap-1 p-1 rounded-2xl ring-1 ring-white/8 w-fit" style={{ background: 'var(--ink-2)' }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all press',
                            activeTab === tab.id
                                ? 'bg-white/10 text-white ring-1 ring-white/10'
                                : 'hover:text-white hover:bg-white/5'
                        )}
                        style={{ color: activeTab === tab.id ? undefined : 'var(--fg-3)' }}>
                        <tab.icon className="size-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && hasRoom && (
                <div className="space-y-6">
                    <StatsStrip room={room} />

                    <Card className="space-y-5">
                        {/* Analytics header */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <SectionHead label="Room Analytics" sub="Track performance by time range and granularity" />
                            <div className="flex items-center gap-2 flex-wrap">
                                <select value={analyticsGranularity} onChange={e => setAnalyticsGranularity(e.target.value as AnalyticsGranularity)}
                                    className="h-8 rounded-xl ring-1 ring-white/10 px-2.5 mono text-[11px] outline-none"
                                    style={{ background: 'var(--ink-1)', color: 'var(--fg-2)' }}>
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <Input type="datetime-local" value={analyticsFrom} onChange={e => setAnalyticsFrom(e.target.value)}
                                    className="h-8 w-44 mono text-[11px]" style={{ background: 'var(--ink-1)' }} />
                                <Input type="datetime-local" value={analyticsTo} onChange={e => setAnalyticsTo(e.target.value)}
                                    className="h-8 w-44 mono text-[11px]" style={{ background: 'var(--ink-1)' }} />
                                <button onClick={applyAnalyticsRange} className="h-8 px-3 rounded-xl ring-1 ring-white/10 mono text-[11px] press hover:bg-white/5"
                                    style={{ color: 'var(--fg-2)' }}>Apply</button>
                                <button onClick={() => setAnalyticsRefreshTick(t => t + 1)} className="h-8 px-3 rounded-xl ring-1 ring-white/10 mono text-[11px] press hover:bg-white/5"
                                    style={{ color: 'var(--fg-2)' }}>Refresh</button>
                            </div>
                        </div>

                        {/* Summary stats grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-6 rounded-xl overflow-hidden ring-1 ring-white/8 divide-x divide-y lg:divide-y-0 divide-white/8">
                            {[
                                { label: 'Sessions',       val: summary.sessions,                color: 'text-white' },
                                { label: 'Listeners',      val: summary.listeners,               color: 'text-[oklch(0.8_0.15_295)]' },
                                { label: 'Avg/session',    val: summary.avgListenersPerSession,  color: 'text-[oklch(0.75_0.14_160)]' },
                                { label: 'Listen time',    val: toHours(summary.minutesListened), color: 'text-[oklch(0.75_0.14_230)]', raw: true },
                                { label: 'Coins earned',   val: summary.coinsEarned,             color: 'text-[oklch(0.88_0.12_75)]' },
                                { label: 'Peak listeners', val: summary.peakListeners,           color: 'text-[oklch(0.8_0.15_330)]' },
                            ].map(({ label, val, color, raw }) => (
                                <div key={label} className="px-4 py-3" style={{ background: 'var(--ink-1)' }}>
                                    <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
                                    <p className={cn('mono text-[20px] font-semibold leading-none tabular-nums', color)}>
                                        {raw ? val : typeof val === 'number' ? val.toLocaleString() : val}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {analyticsLoading ? (
                            <div className="flex items-center gap-2 py-8" style={{ color: 'var(--fg-3)' }}>
                                <Loader2 className="size-4 animate-spin" />
                                <span className="mono text-[11px]">Loading analytics…</span>
                            </div>
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
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
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
                                    {topSongs.length === 0
                                        ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No data yet</div>
                                        : (
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
                                    {topSongs.length === 0
                                        ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No data yet</div>
                                        : (
                                            <ResponsiveContainer width="100%" height={220}>
                                                <PieChart>
                                                    <Pie data={topSongs.slice(0, 8)} dataKey="streams" nameKey="title" outerRadius={78} innerRadius={42} paddingAngle={2}>
                                                        {topSongs.slice(0, 8).map((e, idx) => <Cell key={e.songId} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip contentStyle={CHART_TOOLTIP} />
                                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                </ChartShell>
                                <ChartShell title="Top sessions">
                                    {topSessions.length === 0
                                        ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No sessions yet</div>
                                        : (
                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                {topSessions.map((s, i) => (
                                                    <div key={i} className="rounded-xl ring-1 ring-white/8 px-3 py-2.5" style={{ background: 'var(--ink-1)' }}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{fmtDateLong(s.startedAt)}</p>
                                                            <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{s.endedAt ? fmtDateLong(s.endedAt) : 'Live'}</p>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                                                            <div><p className="mono text-[16px] font-semibold text-white">{s.listenerCount}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>listeners</p></div>
                                                            <div><p className="mono text-[16px] font-semibold text-[oklch(0.75_0.14_160)]">{toHours(s.minutesListened)}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>listened</p></div>
                                                            <div><p className="mono text-[16px] font-semibold text-[oklch(0.88_0.12_75)]">{s.coinsEarned.toLocaleString()}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>coins</p></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </ChartShell>
                            </div>
                        )}
                    </Card>

                    {/* Recent sessions */}
                    {room.sessions && room.sessions.length > 0 && (
                        <div className="space-y-3">
                            <SectionHead label="Recent Sessions" />
                            <div className="space-y-2">
                                {[...room.sessions].reverse().slice(0, 5).map((sess: RoomSession, i: number) => (
                                    <div key={i} className="rounded-xl ring-1 ring-white/8 px-5 py-3 flex items-center justify-between gap-4" style={{ background: 'var(--ink-2)' }}>
                                        <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
                                            {sess.endedAt ? new Date(sess.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                        </p>
                                        <div className="flex items-center gap-6">
                                            <span className="mono text-[13px] text-white">{sess.listenerCount} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>listeners</span></span>
                                            <span className="mono text-[13px] text-white">{toHours(sess.minutesListened ?? 0)} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>listened</span></span>
                                            <span className="mono text-[13px] text-[oklch(0.88_0.12_75)]">{sess.coinsEarned?.toLocaleString()} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>coins</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'overview' && !hasRoom && (
                <Card className="py-16 text-center">
                    <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>No channel yet — create one in the Settings tab</p>
                    <button onClick={() => setActiveTab('settings')} className="mt-4 h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                        Go to Settings
                    </button>
                </Card>
            )}

            {/* ── PLAYLISTS TAB ── */}
            {activeTab === 'playlists' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <SectionHead label="Saved Playlists" sub="Build playlists once, load them into any session" />
                        <button onClick={() => setShowPlaylistForm(p => !p)}
                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 press">
                            <Plus className="size-3.5" /> New Playlist
                        </button>
                    </div>

                    {showPlaylistForm && (
                        <Card className="space-y-4">
                            <p className="text-[14px] font-semibold text-white">Create Playlist</p>
                            <div>
                                <FieldLabel>Playlist name</FieldLabel>
                                <Input placeholder="e.g. Late Night Jazz" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>
                            <div>
                                <FieldLabel>Songs</FieldLabel>
                                {songsLoading ? <Skeleton className="h-48 bg-white/5" /> : (
                                    <SongSelector songs={songs} selectedIds={newPlaylistSongs} onChange={setNewPlaylistSongs} />
                                )}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowPlaylistForm(false)} className="h-9 px-4 rounded-xl text-[13px] press hover:bg-white/5"
                                    style={{ color: 'var(--fg-3)' }}>Cancel</button>
                                <button onClick={handleCreatePlaylist} disabled={creatingPlaylist || !newPlaylistName.trim()}
                                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/10 ring-1 ring-white/10 text-[13px] text-white disabled:opacity-50 hover:bg-white/15 press">
                                    {creatingPlaylist ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                                </button>
                            </div>
                        </Card>
                    )}

                    {playlistsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}
                        </div>
                    ) : playlists.length === 0 ? (
                        <Card className="py-16 text-center">
                            <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No playlists yet — create one above</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {playlists.map(p => (
                                <Card key={p._id} className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-semibold text-white truncate">{p.name}</p>
                                            <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{p.songs.length} songs</p>
                                        </div>
                                        <button onClick={() => handleDeletePlaylist(p._id)} className="press hover:text-[oklch(0.72_0.22_20)] transition-colors" style={{ color: 'var(--fg-3)' }}>
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {p.songs.slice(0, 5).map(s => (
                                            <img key={s._id} src={s.imageUrl} alt={s.title} title={s.title}
                                                className="size-8 rounded-lg object-cover ring-1 ring-black/50" />
                                        ))}
                                        {p.songs.length > 5 && (
                                            <div className="size-8 rounded-lg ring-1 ring-black/50 grid place-items-center mono text-[10px]"
                                                style={{ background: 'var(--ink-1)', color: 'var(--fg-3)' }}>
                                                +{p.songs.length - 5}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => loadPlaylistIntoRoom(p)}
                                        className="w-full flex items-center justify-center gap-2 h-8 rounded-xl ring-1 ring-white/10 text-[12px] press hover:bg-white/8 transition-colors"
                                        style={{ color: 'var(--fg-2)' }}>
                                        <Play className="size-3" /> Load into room
                                    </button>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── BROADCASTS TAB ── */}
            {activeTab === 'broadcasts' && (
                <BroadcastAssetsTab
                    assets={broadcastAssets}
                    loading={broadcastsLoading}
                    onAssetsChange={setBroadcastAssets}
                />
            )}

            {/* ── MINIGAMES TAB ── */}
            {activeTab === 'minigames' && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <SectionHead label="Minigames" sub="Schedule games or trigger manually during a live session" />
                        {hasRoom && (
                            <button onClick={() => setShowMinigameForm(p => !p)}
                                className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 press">
                                <Plus className="size-3.5" /> New Game
                            </button>
                        )}
                    </div>

                    {!hasRoom && (
                        <Card className="py-16 text-center">
                            <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>Create a channel first in Settings</p>
                        </Card>
                    )}

                    {showMinigameForm && hasRoom && (
                        <Card className="space-y-4">
                            <p className="text-[14px] font-semibold text-white">Create Minigame</p>

                            <div>
                                <FieldLabel>Game title</FieldLabel>
                                <Input placeholder="e.g. Song Blitz Round 1" value={gameTitle} onChange={e => setGameTitle(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>

                            <div>
                                <FieldLabel>Game type</FieldLabel>
                                <div className="grid grid-cols-2 gap-2">
                                    {GAME_TYPES.map(gt => (
                                        <button key={gt.value} onClick={() => setGameType(gt.value)}
                                            className={cn(
                                                'p-3 rounded-xl ring-1 text-left transition-all press',
                                                gameType === gt.value
                                                    ? 'ring-[oklch(0.72_0.22_295_/_0.5)] bg-[oklch(0.55_0.18_295_/_0.12)] text-white'
                                                    : 'ring-white/8 text-white/50 hover:ring-white/20'
                                            )}>
                                            <p className="text-[13px] font-medium">{gt.label}</p>
                                            <p className="mono text-[10px] mt-0.5 opacity-70">{gt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {gameType === 'song_guesser' && (
                                <div>
                                    <FieldLabel>Correct song title</FieldLabel>
                                    <Input placeholder="Case-insensitive match" value={gameAnswer} onChange={e => setGameAnswer(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                                </div>
                            )}
                            {gameType === 'lyric_fill' && (
                                <div className="space-y-2">
                                    <div>
                                        <FieldLabel>Lyric with blank</FieldLabel>
                                        <Input placeholder='e.g. "Never gonna give you ___"' value={gameLyric} onChange={e => setGameLyric(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                                    </div>
                                    <div>
                                        <FieldLabel>Correct answer</FieldLabel>
                                        <Input placeholder="up" value={gameAnswer} onChange={e => setGameAnswer(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                                    </div>
                                </div>
                            )}
                            {gameType === 'trivia' && (
                                <div className="space-y-2">
                                    <div>
                                        <FieldLabel>Question</FieldLabel>
                                        <Input placeholder="What year did this album drop?" value={gameQuestion} onChange={e => setGameQuestion(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                                    </div>
                                    {gameOptions.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <button onClick={() => setGameCorrectOption(i)}
                                                className={cn('size-5 rounded-full ring-2 shrink-0 transition-colors press',
                                                    gameCorrectOption === i ? 'ring-[oklch(0.75_0.14_160)] bg-[oklch(0.75_0.14_160)]' : 'ring-white/20'
                                                )} />
                                            <Input placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                                                onChange={e => setGameOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                                                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20 flex-1" />
                                        </div>
                                    ))}
                                    <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Circle = correct answer</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <FieldLabel>Trigger</FieldLabel>
                                    <select value={gameTrigger} onChange={e => setGameTrigger(e.target.value as MinigameTriggerType)}
                                        className="w-full h-9 rounded-xl ring-1 ring-white/10 px-3 text-[13px] outline-none"
                                        style={{ background: 'var(--ink-1)', color: 'var(--fg-2)' }}>
                                        {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                {gameTrigger !== 'manual' && (
                                    <div>
                                        <FieldLabel>Song index (0-based)</FieldLabel>
                                        <Input type="number" min="0" placeholder="2" value={gameSongIndex} onChange={e => setGameSongIndex(e.target.value)}
                                            className="h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                                    </div>
                                )}
                                <div>
                                    <FieldLabel>Duration (seconds)</FieldLabel>
                                    <Input type="number" min="10" max="120" value={gameDuration} onChange={e => setGameDuration(e.target.value)}
                                        className="h-9 bg-white/5 border-white/10 text-white focus-visible:ring-white/20" />
                                </div>
                                <div>
                                    <FieldLabel>Coin reward (winner)</FieldLabel>
                                    <Input type="number" min="0" value={gameCoinReward} onChange={e => setGameCoinReward(e.target.value)}
                                        className="h-9 bg-white/5 border-white/10 text-white focus-visible:ring-white/20" />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowMinigameForm(false)} className="h-9 px-4 rounded-xl text-[13px] press hover:bg-white/5" style={{ color: 'var(--fg-3)' }}>Cancel</button>
                                <button onClick={handleCreateMinigame} disabled={savingGame || !gameTitle.trim()}
                                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] text-white disabled:opacity-50 press"
                                    style={{ background: 'oklch(0.55 0.18 295)' }}>
                                    {savingGame ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Game
                                </button>
                            </div>
                        </Card>
                    )}

                    {minigamesLoading ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}</div>
                    ) : minigames.length === 0 && hasRoom ? (
                        <Card className="py-16 text-center">
                            <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No minigames yet — create one above</p>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {minigames.map(g => (
                                <div key={g._id} className="rounded-2xl ring-1 ring-white/8 px-5 py-3.5 flex items-center gap-4" style={{ background: 'var(--ink-2)' }}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-[14px] font-semibold text-white">{g.title}</p>
                                            <span className={cn('mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full', STATUS_COLORS[g.status] ?? '')}>{g.status}</span>
                                        </div>
                                        <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
                                            {GAME_TYPES.find(t => t.value === g.type)?.label} ·{' '}
                                            {g.trigger.type === 'manual' ? 'Manual trigger' : `${g.trigger.type.replace('_', ' ')} song ${g.trigger.songIndex}`} ·{' '}
                                            {g.durationSeconds}s · {g.coinReward > 0 ? `${g.coinReward} coins` : 'No reward'}
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteMinigame(g._id)} className="press hover:text-[oklch(0.72_0.22_20)] transition-colors shrink-0" style={{ color: 'var(--fg-3)' }}>
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {isLive && (
                        <div className="flex items-center gap-3 rounded-2xl px-5 py-3 ring-1 ring-[oklch(0.55_0.18_250_/_0.3)]"
                            style={{ background: 'oklch(0.55 0.18 250 / 0.08)' }}>
                            <Gamepad2 className="size-4 text-[oklch(0.75_0.1_250)]" />
                            <p className="text-[13px] text-[oklch(0.75_0.1_250)]">
                                You're live — trigger games from the{' '}
                                <button onClick={() => navigate('/studio/live')} className="underline press">Live Dashboard</button>
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === 'settings' && (
                <form onSubmit={handleSave} className="space-y-5 max-w-2xl">

                    {/* Channel info */}
                    <Card className="space-y-5">
                        <SectionHead label="Channel Info" />

                        {/* Cover image */}
                        <div>
                            <FieldLabel>Cover image</FieldLabel>
                            <label className={cn(
                                'flex items-center gap-4 cursor-pointer rounded-xl ring-1 ring-white/10 overflow-hidden transition-all hover:ring-white/20 press',
                                isLive && 'opacity-50 pointer-events-none'
                            )} style={{ background: 'var(--ink-1)' }}>
                                <input type="file" accept="image/*" className="sr-only" onChange={handleCoverImageChange} disabled={isLive} />
                                {coverImageUrl ? (
                                    <img src={coverImageUrl} alt="Cover" className="w-24 h-24 object-cover shrink-0" />
                                ) : (
                                    <div className="w-24 h-24 grid place-items-center shrink-0" style={{ background: 'var(--ink-2)' }}>
                                        <ImageIcon className="size-8" style={{ color: 'var(--fg-3)' }} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 px-4">
                                    {coverUploading ? (
                                        <div className="flex items-center gap-2" style={{ color: 'var(--fg-2)' }}>
                                            <Loader2 className="size-4 animate-spin" />
                                            <span className="text-[13px]">Uploading…</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 text-[13px] text-white">
                                                <Upload className="size-3.5" />
                                                {coverImageUrl ? 'Change cover image' : 'Upload cover image'}
                                            </div>
                                            <p className="mono text-[10px] mt-1" style={{ color: 'var(--fg-3)' }}>JPG, PNG, WebP · max 5 MB</p>
                                        </>
                                    )}
                                </div>
                                {coverImageUrl && !coverUploading && (
                                    <button type="button" onClick={e => { e.preventDefault(); setCoverImageUrl(null); setCoverImageKey(null); }}
                                        className="mr-4 shrink-0 press" style={{ color: 'var(--fg-3)' }}>
                                        <X className="size-4" />
                                    </button>
                                )}
                            </label>
                        </div>

                        <div>
                            <FieldLabel>Channel name</FieldLabel>
                            <Input value={title} onChange={e => setTitle(e.target.value)} disabled={isLive}
                                placeholder="e.g. Late Night Vibes"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                        </div>

                        <div>
                            <FieldLabel>Description <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(optional)</span></FieldLabel>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={isLive}
                                rows={2} placeholder="What kind of music do you play?"
                                className="w-full rounded-xl px-4 py-2.5 text-[13px] text-white outline-none resize-none disabled:opacity-50 placeholder:text-white/25 focus:ring-2 focus:ring-white/15 border border-white/10"
                                style={{ background: 'var(--ink-1)' }} />
                        </div>

                        {/* Tags */}
                        <div>
                            <FieldLabel><Tag className="size-3 inline mr-1 -mt-px" />Room tags <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(pick genres / moods)</span></FieldLabel>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {ALL_TAGS.map(tag => (
                                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                        className={cn(
                                            'h-7 px-3 rounded-full mono text-[10px] uppercase tracking-wider transition-all press',
                                            selectedTags.includes(tag)
                                                ? 'bg-white/15 text-white ring-1 ring-white/25'
                                                : 'ring-1 ring-white/10 hover:ring-white/20'
                                        )}
                                        style={{ color: selectedTags.includes(tag) ? undefined : 'var(--fg-3)' }}>
                                        {tag}
                                    </button>
                                ))}
                            </div>
                            {selectedTags.length > 0 && (
                                <p className="mono text-[10px] mt-2" style={{ color: 'var(--fg-3)' }}>
                                    {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between py-0.5 border-t hair">
                            <div>
                                <p className="text-[13px] text-white">Public channel</p>
                                <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Visible on discovery when live</p>
                            </div>
                            <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLive} />
                        </div>

                        <div>
                            <FieldLabel>Stream goal <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(coins, optional)</span></FieldLabel>
                            <Input type="number" min="1" step="1" value={streamGoal} onChange={e => setStreamGoal(e.target.value)} disabled={isLive}
                                placeholder="e.g. 1000"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            <p className="mono text-[10px] mt-1.5" style={{ color: 'var(--fg-3)' }}>Resets on each go-live.</p>
                        </div>
                    </Card>

                    {/* Playlist */}
                    <Card className="space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionHead label="Playlist" />
                            <button type="button" onClick={() => setActiveTab('playlists')}
                                className="mono text-[10px] press hover:text-white transition-colors" style={{ color: 'var(--fg-3)' }}>
                                Manage saved playlists →
                            </button>
                        </div>
                        {songsLoading ? <Skeleton className="h-48 bg-white/5 rounded-xl" /> : (
                            <SongSelector songs={songs} selectedIds={selectedIds} onChange={setSelectedIds} disabled={isLive} />
                        )}
                    </Card>

                    {error && <p className="text-[13px] text-[oklch(0.72_0.22_20)]">{error}</p>}

                    {!isLive && (
                        <button type="submit" disabled={saving}
                            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold disabled:opacity-50 press">
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {hasRoom ? 'Save Changes' : 'Create Channel'}
                        </button>
                    )}

                    {/* Feature flags */}
                    {hasRoom && (
                        <Card className="space-y-4">
                            <SectionHead label="Room Features" sub="Toggle what listeners can see and do. Changes apply immediately to live rooms." />
                            <div className="space-y-0 divide-y hair">
                                {([
                                    { key: 'liveMic',    label: 'Live Mic',         desc: 'Broadcast voice between songs' },
                                    { key: 'broadcasts', label: 'Broadcast Assets',  desc: 'Play pre-recorded clips' },
                                    { key: 'chat',       label: 'Live Chat',         desc: 'Listeners can send messages' },
                                    { key: 'voting',     label: 'Vote to Skip',      desc: 'Listeners can vote to skip' },
                                    { key: 'voteQueue',  label: 'Vote Queue',        desc: 'Listeners nominate & vote songs in' },
                                    { key: 'donations',  label: 'Donations',         desc: 'Listeners can send you coins' },
                                    { key: 'minigames',  label: 'Minigames',         desc: 'Listeners see minigame panels' },
                                ] as { key: keyof RoomFeatureFlags; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                    <div key={key} className="flex items-center justify-between py-3">
                                        <div>
                                            <p className="text-[13px] text-white">{label}</p>
                                            <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{desc}</p>
                                        </div>
                                        <Switch
                                            checked={featureFlags[key]}
                                            onCheckedChange={val => setFeatureFlags(f => ({ ...f, [key]: val }))}
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={handleSaveFeatureFlags} disabled={savingFlags}
                                className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 press"
                                style={{ background: 'oklch(0.55 0.18 295)' }}>
                                {savingFlags ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                Save Features
                            </button>
                        </Card>
                    )}
                </form>
            )}

            <GoLiveDialog open={goLiveDialogOpen} onCancel={() => setGoLiveDialogOpen(false)} onConfirm={handleGoLiveConfirm} />
        </div>
    );
};

export default StudioPage;
