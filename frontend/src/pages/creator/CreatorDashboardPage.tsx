import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, Users, Clock, Gem, Heart, Save, Loader2, ExternalLink, Search, Check, Plus } from 'lucide-react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
    Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs, getCreatorRoomAnalytics } from '@/lib/roomService';
import type { CreatorRoomAnalytics, RoomInfo, RoomSession, Song } from '@/types/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

type AnalyticsGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

const CHART_AXIS = { fontSize: 10, fill: '#71717a' };
const CHART_GRID = '#27272a';
const CHART_TOOLTIP = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 };
const CHART_COLORS = ['#a78bfa', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#22d3ee', '#fb7185', '#a3e635'];

const toDateTimeInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const toDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
const fmtDateShort = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : value;
};
const fmtDateLong = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : value;
};
const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => {
        const aT = toDate(a.date)?.getTime() ?? 0;
        const bT = toDate(b.date)?.getTime() ?? 0;
        return aT - bT;
    });

// ── Stats strip ───────────────────────────────────────────────────────────

const StatsStrip = ({ room }: { room: RoomInfo }) => {
    const s = room.stats;
    const items = [
        { icon: Radio,  label: 'Sessions',  value: s.totalSessions.toLocaleString(),   color: 'text-purple-400' },
        { icon: Users,  label: 'Listeners', value: s.totalListeners.toLocaleString(),   color: 'text-blue-400' },
        { icon: Clock,  label: 'Listened',  value: toHours(s.totalMinutesListened),     color: 'text-indigo-400' },
        { icon: Gem,    label: 'Coins',     value: s.totalCoinsEarned.toLocaleString(), color: 'text-yellow-400' },
        { icon: Heart,  label: 'Favorites', value: room.favoriteCount.toLocaleString(), color: 'text-pink-400' },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {items.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Icon className={cn('size-4 mx-auto mb-1', color)} />
                    <p className="text-sm font-bold text-white">{value}</p>
                    <p className="text-[10px] text-zinc-500">{label}</p>
                </div>
            ))}
        </div>
    );
};

const ChartShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-zinc-400 font-medium mb-3">{title}</p>
        {children}
    </div>
);

// ── Apple Music-style song selector ─────────────────────────────────────

const SongSelector = ({
    songs, selectedIds, onChange, disabled,
}: {
    songs: Song[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}) => {
    const [query, setQuery] = useState('');
    const filtered = songs.filter(s =>
        query.trim() === '' ? true :
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
    );
    const toggle = (id: string) =>
        onChange(selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id]);

    return (
        <div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                <Input
                    placeholder="Search songs or artists…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9 text-sm"
                />
            </div>

            {/* Count */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{selectedIds.length} selected</span>
                {selectedIds.length > 0 && (
                    <button onClick={() => onChange([])} className="text-xs text-zinc-500 hover:text-white transition-colors">
                        Clear all
                    </button>
                )}
            </div>

            {/* Song list */}
            <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                    <p className="text-zinc-600 text-xs text-center py-6">No songs found</p>
                ) : filtered.map(song => {
                    const selected = selectedIds.includes(song._id);
                    return (
                        <button
                            key={song._id}
                            type="button"
                            onClick={() => toggle(song._id)}
                            className={cn(
                                'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all text-left group',
                                selected ? 'bg-white/8' : 'hover:bg-white/5',
                            )}
                        >
                            <div className="relative flex-shrink-0">
                                <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover" />
                                {selected && (
                                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                                        <Check className="size-4 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate transition-colors', selected ? 'text-white' : 'text-zinc-300 group-hover:text-white')}>{song.title}</p>
                                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                            </div>
                            <div className={cn(
                                'flex-shrink-0 size-6 rounded-full border flex items-center justify-center transition-all',
                                selected
                                    ? 'border-white/30 bg-white/15 text-white'
                                    : 'border-white/10 text-zinc-600 group-hover:border-white/20'
                            )}>
                                {selected ? <Check className="size-3" /> : <Plus className="size-3" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ── Go Live Countdown AlertDialog ─────────────────────────────────────────

const GoLiveDialog = ({
    open,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const [count, setCount] = useState(5);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!open) { setCount(5); return; }
        setCount(5);
        timerRef.current = setInterval(() => {
            setCount(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [open]);

    // Auto-confirm when countdown hits 0
    useEffect(() => {
        if (open && count === 0) onConfirm();
    }, [count, open, onConfirm]);

    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Going Live</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your room will go live and listeners will be notified. Ready?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Countdown ring */}
                <div className="flex justify-center py-4">
                    <div className="relative size-20">
                        <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                            <circle
                                cx="40" cy="40" r="34" fill="none"
                                stroke="#ef4444" strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 34}`}
                                strokeDashoffset={`${2 * Math.PI * 34 * (1 - count / 5)}`}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold text-white tabular-nums">{count}</span>
                        </div>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
                    <button
                        onClick={onConfirm}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        Go Live Now
                    </button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

// ── Page ──────────────────────────────────────────────────────────────────

const CreatorDashboardPage = () => {
    const navigate = useNavigate();

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
    const [analytics, setAnalytics] = useState<CreatorRoomAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [initialRange] = useState(() => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86_400_000);
        return { from: toDateTimeInputValue(from), to: toDateTimeInputValue(to) };
    });
    const [analyticsGranularity, setAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [analyticsFrom, setAnalyticsFrom] = useState(initialRange.from);
    const [analyticsTo, setAnalyticsTo] = useState(initialRange.to);
    const [appliedAnalyticsGranularity, setAppliedAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [appliedAnalyticsFrom, setAppliedAnalyticsFrom] = useState(initialRange.from);
    const [appliedAnalyticsTo, setAppliedAnalyticsTo] = useState(initialRange.to);
    const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);

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
        const loadAnalytics = async () => {
            const fromIso = toDate(appliedAnalyticsFrom)?.toISOString();
            const toIso = toDate(appliedAnalyticsTo)?.toISOString();
            try {
                const data = await getCreatorRoomAnalytics({
                    granularity: appliedAnalyticsGranularity,
                    from: fromIso,
                    to: toIso,
                });
                if (!cancelled) setAnalytics(data);
            } catch {
                if (!cancelled) toast.error('Failed to load room analytics');
            } finally {
                if (!cancelled) setAnalyticsLoading(false);
            }
        };
        void loadAnalytics();
        return () => { cancelled = true; };
    }, [appliedAnalyticsGranularity, appliedAnalyticsFrom, appliedAnalyticsTo, analyticsRefreshTick]);

    const applyAnalyticsRange = () => {
        const fromDate = toDate(analyticsFrom);
        const toDateValue = toDate(analyticsTo);
        if (!fromDate || !toDateValue) {
            toast.error('Invalid date range');
            return;
        }
        if (fromDate >= toDateValue) {
            toast.error('From time must be before To time');
            return;
        }
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleGoLiveConfirm = async () => {
        setGoLiveDialogOpen(false);
        if (!room) return;
        setToggling(true);
        setError(null);
        try {
            await goLive(room._id);
            navigate(`/rooms/${room._id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to go live');
            setToggling(false);
        }
    };

    const handleGoOffline = async () => {
        if (!room) return;
        setToggling(true);
        setError(null);
        try {
            await goOffline(room._id);
            const refreshed = await getMyRoom();
            setRoom(refreshed);
            setAnalyticsRefreshTick(t => t + 1);
            toast.success('Room is now offline');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to go offline');
        } finally {
            setToggling(false);
        }
    };

    // Loading skeleton
    if (room === undefined) {
        return (
            <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-40 bg-white/5" />
                        <Skeleton className="h-4 w-28 bg-white/5" />
                    </div>
                    <Skeleton className="h-9 w-24 bg-white/5 rounded-xl" />
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl bg-white/5" />)}
                </div>
            </div>
        );
    }

    const isLive  = room?.status === 'live';
    const hasRoom = !!room;
    const sessionTrend = sortByDateAsc(analytics?.sessionTrend ?? []);
    const donationTrend = sortByDateAsc(analytics?.donationTrend ?? []);
    const topSongs = analytics?.topSongs ?? [];
    const topSessions = analytics?.topSessions ?? [];
    const summary = analytics?.summary ?? {
        sessions: 0,
        listeners: 0,
        minutesListened: 0,
        coinsEarned: 0,
        peakListeners: 0,
        avgListenersPerSession: 0,
    };

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">

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
                                <Link to={`/rooms/${room._id}`} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                                    <ExternalLink className="size-3.5" /> View Room
                                </Link>
                                <button
                                    onClick={handleGoOffline}
                                    disabled={toggling}
                                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors"
                                >
                                    {toggling ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                    Go Offline
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setGoLiveDialogOpen(true)}
                                disabled={toggling || selectedIds.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
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
                    <p className="text-sm text-red-400 font-medium">You are live — settings locked until you go offline</p>
                </div>
            )}

            {/* Lifetime stats */}
            {hasRoom && <StatsStrip room={room} />}

            {/* Room analytics */}
            {hasRoom && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Room Analytics</h2>
                            <p className="text-xs text-zinc-500 mt-1">
                                Track this room by time range and granularity.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={analyticsGranularity}
                                onChange={e => setAnalyticsGranularity(e.target.value as AnalyticsGranularity)}
                                className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-zinc-300"
                            >
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                            <Input
                                type="datetime-local"
                                value={analyticsFrom}
                                onChange={e => setAnalyticsFrom(e.target.value)}
                                className="h-9 w-[178px] bg-white/5 border-white/10 text-xs text-zinc-300"
                            />
                            <Input
                                type="datetime-local"
                                value={analyticsTo}
                                onChange={e => setAnalyticsTo(e.target.value)}
                                className="h-9 w-[178px] bg-white/5 border-white/10 text-xs text-zinc-300"
                            />
                            <button
                                type="button"
                                onClick={applyAnalyticsRange}
                                className="h-9 px-3 rounded-lg border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Apply
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnalyticsRefreshTick(t => t + 1)}
                                className="h-9 px-3 rounded-lg border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-600">
                        Showing {analytics?.granularity ?? appliedAnalyticsGranularity} from {fmtDateLong(analytics?.from ?? toDate(appliedAnalyticsFrom)?.toISOString() ?? '')} to {fmtDateLong(analytics?.to ?? toDate(appliedAnalyticsTo)?.toISOString() ?? '')}
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-6 border border-white/10 rounded-xl overflow-hidden divide-x divide-y lg:divide-y-0 divide-white/10">
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Sessions</p>
                            <p className="text-lg font-semibold text-white">{summary.sessions.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Listeners</p>
                            <p className="text-lg font-semibold text-violet-300">{summary.listeners.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Avg listeners/session</p>
                            <p className="text-lg font-semibold text-emerald-300">{summary.avgListenersPerSession.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Listen time</p>
                            <p className="text-lg font-semibold text-sky-300">{toHours(summary.minutesListened)}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Coins earned</p>
                            <p className="text-lg font-semibold text-yellow-300">{summary.coinsEarned.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-zinc-500">Peak listeners</p>
                            <p className="text-lg font-semibold text-pink-300">{summary.peakListeners.toLocaleString()}</p>
                        </div>
                    </div>

                    {analyticsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-400 py-5"><Loader2 className="size-4 animate-spin" /> Loading analytics…</div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <ChartShell title="Session trend (sessions vs listeners)">
                                {sessionTrend.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No data in this range</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={sessionTrend}>
                                            <defs>
                                                <linearGradient id="creatorSessions" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="creatorListeners" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                            <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis yAxisId="sessions" tick={CHART_AXIS} allowDecimals={false} />
                                            <YAxis yAxisId="listeners" orientation="right" tick={CHART_AXIS} allowDecimals={false} />
                                            <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={(value) => fmtDateLong(String(value))} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                            <Area yAxisId="sessions" type="monotone" dataKey="sessions" name="Sessions" stroke="#a78bfa" fill="url(#creatorSessions)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="listeners" type="monotone" dataKey="listeners" name="Listeners" stroke="#34d399" fill="url(#creatorListeners)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartShell>

                            <ChartShell title="Donation trend">
                                {donationTrend.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No donations in this range</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={donationTrend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                                            <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis tick={CHART_AXIS} />
                                            <Tooltip
                                                contentStyle={CHART_TOOLTIP}
                                                labelFormatter={(value) => fmtDateLong(String(value))}
                                                formatter={(value, _name, payload) => {
                                                    const row = payload?.payload as { count: number };
                                                    return [`${Number(value).toLocaleString()} coins · ${row.count} donations`, 'Donations'];
                                                }}
                                            />
                                            <Bar dataKey="amount" name="Donations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartShell>

                            <ChartShell title="Top songs in this room">
                                {topSongs.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No song plays in this range</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={Math.max(180, Math.min(10, topSongs.length) * 30)}>
                                        <BarChart data={topSongs.slice(0, 10)} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                                            <XAxis type="number" tick={CHART_AXIS} allowDecimals={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="title"
                                                width={130}
                                                tick={{ ...CHART_AXIS, fontSize: 11 }}
                                                tickFormatter={(value) => String(value).length > 20 ? `${String(value).slice(0, 20)}…` : String(value)}
                                            />
                                            <Tooltip
                                                contentStyle={CHART_TOOLTIP}
                                                formatter={(value, _name, payload) => {
                                                    const row = payload?.payload as CreatorRoomAnalytics['topSongs'][number];
                                                    return [`${Number(value).toLocaleString()} streams · ${row.plays} plays · ${row.skipRate}% skips`, row.artist];
                                                }}
                                            />
                                            <Bar dataKey="streams" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartShell>

                            <ChartShell title="Top sessions">
                                {topSessions.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No sessions in this range</div>
                                ) : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {topSessions.map((session, i) => (
                                            <div key={`${session.startedAt}-${i}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs text-zinc-400">{fmtDateLong(session.startedAt)}</p>
                                                    <p className="text-xs text-zinc-600">{session.endedAt ? fmtDateLong(session.endedAt) : 'Live'}</p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">{session.listenerCount}</p>
                                                        <p className="text-[10px] text-zinc-500">listeners</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-emerald-300">{toHours(session.minutesListened)}</p>
                                                        <p className="text-[10px] text-zinc-500">listened</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-yellow-300">{session.coinsEarned.toLocaleString()}</p>
                                                        <p className="text-[10px] text-zinc-500">coins</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ChartShell>

                            <ChartShell title="Song stream share">
                                {topSongs.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-xs text-zinc-600">No stream-share data</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={topSongs.slice(0, 8)} dataKey="streams" nameKey="title" outerRadius={78} innerRadius={42} paddingAngle={2}>
                                                {topSongs.slice(0, 8).map((entry, idx) => (
                                                    <Cell key={`${entry.songId}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [Number(value).toLocaleString(), 'Streams']} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartShell>
                        </div>
                    )}
                </section>
            )}

            {/* Room setup form */}
            <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
                <div className="border-t border-white/5 pt-6">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                        {hasRoom ? 'Room Settings' : 'Create Your Channel'}
                    </h2>
                    <div className="space-y-4">

                        {/* Title */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Channel name</label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                disabled={isLive}
                                placeholder="e.g. Late Night Vibes"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-zinc-600 focus-visible:ring-white/20"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                disabled={isLive}
                                rows={2}
                                placeholder="What kind of music do you play?"
                                className="w-full bg-white/5 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 placeholder:text-zinc-600 resize-none text-sm border border-white/10"
                            />
                        </div>

                        {/* Visibility */}
                        <div className="flex items-center justify-between py-1">
                            <div>
                                <p className="text-sm text-zinc-300">Public channel</p>
                                <p className="text-xs text-zinc-600">Visible on discovery when live</p>
                            </div>
                            <Switch
                                checked={isPublic}
                                onCheckedChange={setIsPublic}
                                disabled={isLive}
                            />
                        </div>

                        {/* Stream goal */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Stream goal <span className="text-zinc-600">(coins, optional)</span></label>
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                value={streamGoal}
                                onChange={e => setStreamGoal(e.target.value)}
                                disabled={isLive}
                                placeholder="e.g. 1000"
                                className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-zinc-600 focus-visible:ring-white/20"
                            />
                            <p className="text-xs text-zinc-600 mt-1">Resets on each go-live.</p>
                        </div>

                        {/* Playlist */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Playlist</label>
                            {songsLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                                            <Skeleton className="size-10 rounded-lg bg-white/5" />
                                            <div className="flex-1 space-y-1.5">
                                                <Skeleton className="h-3.5 w-3/4 bg-white/5" />
                                                <Skeleton className="h-3 w-1/2 bg-white/5" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <SongSelector songs={songs} selectedIds={selectedIds} onChange={setSelectedIds} disabled={isLive} />
                            )}
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                {!isLive && (
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                    >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {hasRoom ? 'Save Changes' : 'Create Channel'}
                    </button>
                )}
            </form>

            {/* Recent sessions */}
            {hasRoom && room.sessions && room.sessions.length > 0 && (
                <div className="border-t border-white/5 pt-6">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent Sessions</h2>
                    <div className="space-y-2">
                        {[...room.sessions].reverse().slice(0, 5).map((sess: RoomSession, i: number) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                                <p className="text-xs text-zinc-500">
                                    {sess.endedAt ? new Date(sess.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                </p>
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

            {/* Go Live countdown dialog */}
            <GoLiveDialog
                open={goLiveDialogOpen}
                onCancel={() => setGoLiveDialogOpen(false)}
                onConfirm={handleGoLiveConfirm}
            />
        </div>
    );
};

export default CreatorDashboardPage;
