import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, Users, Clock, Gem, Heart, Save, Loader, ExternalLink } from 'lucide-react';
import { getMyRoom, upsertRoom, goLive, goOffline, getSongs } from '@/lib/roomService';
import type { RoomInfo, RoomSession, Song } from '@/types/types';
import { cn } from '@/lib/utils';

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
        { icon: Radio,  label: 'Sessions',   value: s.totalSessions.toLocaleString(),         color: 'text-purple-400' },
        { icon: Users,  label: 'Listeners',  value: s.totalListeners.toLocaleString(),         color: 'text-blue-400' },
        { icon: Clock,  label: 'Listened',   value: toHours(s.totalMinutesListened),           color: 'text-indigo-400' },
        { icon: Gem,    label: 'Coins',      value: s.totalCoinsEarned.toLocaleString(),       color: 'text-yellow-400' },
        { icon: Heart,  label: 'Favorites',  value: room.favoriteCount.toLocaleString(),       color: 'text-pink-400' },
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

// ── Song selector ─────────────────────────────────────────────────────────

const SongSelector = ({
    songs, selectedIds, onChange,
}: {
    songs: Song[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}) => {
    const toggle = (id: string) =>
        onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);

    return (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {songs.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">Loading songs…</p>
            ) : songs.map((song) => {
                const selected = selectedIds.includes(song._id);
                return (
                    <button
                        key={song._id}
                        type="button"
                        onClick={() => toggle(song._id)}
                        className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left',
                            selected ? 'bg-purple-600/20 ring-1 ring-purple-500' : 'bg-zinc-800 hover:bg-zinc-700',
                        )}
                    >
                        <img src={song.imageUrl} alt={song.title} className="size-9 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{song.title}</p>
                            <p className="text-zinc-400 text-xs truncate">{song.artist}</p>
                        </div>
                        {selected && <div className="size-2 rounded-full bg-purple-400 shrink-0" />}
                    </button>
                );
            })}
        </div>
    );
};

// ── Page ──────────────────────────────────────────────────────────────────

const CreatorDashboardPage = () => {
    const navigate = useNavigate();

    const [room, setRoom] = useState<RoomInfo | null | undefined>(undefined); // undefined = loading
    const [songs, setSongs] = useState<Song[]>([]);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [streamGoal, setStreamGoal] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        Promise.all([getMyRoom(), getSongs()])
            .then(([myRoom, allSongs]) => {
                setRoom(myRoom);
                setSongs(allSongs);
                if (myRoom) {
                    setTitle(myRoom.title);
                    setDescription(myRoom.description ?? '');
                    setIsPublic(myRoom.isPublic);
                    setStreamGoal(myRoom.streamGoal > 0 ? String(myRoom.streamGoal) : '');
                    setSelectedIds(myRoom.playlist.map((s) => s._id));
                }
            })
            .catch(() => setError('Failed to load room data'));
    }, []);

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
            });
            setRoom(saved);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleGoLive = async () => {
        if (!room) return;
        setToggling(true);
        setError(null);
        try {
            await goLive(room._id);
            navigate(`/rooms/${room._id}`);
        } catch (err: unknown) {
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to go offline');
        } finally {
            setToggling(false);
        }
    };

    // Loading
    if (room === undefined) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader className="size-6 animate-spin text-zinc-500" />
            </div>
        );
    }

    const isLive    = room?.status === 'live';
    const hasRoom   = !!room;

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
                                <Link
                                    to={`/rooms/${room._id}`}
                                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                                >
                                    <ExternalLink className="size-3.5" /> View Room
                                </Link>
                                <button
                                    onClick={handleGoOffline}
                                    disabled={toggling}
                                    className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors"
                                >
                                    {toggling ? <Loader className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                    Go Offline
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleGoLive}
                                disabled={toggling}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                {toggling ? <Loader className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                Go Live
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Live status banner */}
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
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isLive}
                                placeholder="e.g. Late Night Vibes"
                                className="w-full bg-zinc-800 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isLive}
                                rows={2}
                                placeholder="What kind of music do you play?"
                                className="w-full bg-zinc-800 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600 resize-none"
                            />
                        </div>

                        {/* Visibility */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-300">Public channel</p>
                                <p className="text-xs text-zinc-600">Visible on the home discovery page when live</p>
                            </div>
                            <button
                                type="button"
                                disabled={isLive}
                                onClick={() => setIsPublic((v) => !v)}
                                className={cn(
                                    'w-10 h-5 rounded-full transition-colors relative',
                                    isPublic ? 'bg-purple-600' : 'bg-zinc-700',
                                    isLive && 'opacity-50 cursor-not-allowed',
                                )}
                            >
                                <span className={cn(
                                    'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                                    isPublic ? 'translate-x-5' : 'translate-x-0.5',
                                )} />
                            </button>
                        </div>

                        {/* Stream goal */}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">
                                Stream goal <span className="text-zinc-600">(coins, optional)</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={streamGoal}
                                onChange={(e) => setStreamGoal(e.target.value)}
                                disabled={isLive}
                                placeholder="e.g. 1000"
                                className="w-full bg-zinc-800 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                            />
                            <p className="text-xs text-zinc-600 mt-1">Resets on each go-live. Listeners donate coins toward this goal.</p>
                        </div>

                        {/* Playlist */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-sm text-zinc-400">Playlist</label>
                                <span className="text-xs text-purple-400">{selectedIds.length} songs</span>
                            </div>
                            <div className={isLive ? 'opacity-50 pointer-events-none' : ''}>
                                <SongSelector songs={songs} selectedIds={selectedIds} onChange={setSelectedIds} />
                            </div>
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                {!isLive && (
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-colors"
                    >
                        {saving ? <Loader className="size-4 animate-spin" /> : <Save className="size-4" />}
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
                                <div>
                                    <p className="text-xs text-zinc-500">
                                        {sess.endedAt ? new Date(sess.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                    </p>
                                </div>
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
    );
};

export default CreatorDashboardPage;
