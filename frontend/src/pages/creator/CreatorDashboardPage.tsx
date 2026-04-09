import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, Users, Clock, Gem, Heart, Save, Loader2, ExternalLink, Search, Check, Plus, X } from 'lucide-react';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs } from '@/lib/roomService';
import type { RoomInfo, RoomSession, Song } from '@/types/types';
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

    return (
        <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">

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

            {/* Room setup form */}
            <form onSubmit={handleSave} className="space-y-5">
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
