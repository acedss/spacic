import { useEffect, useState, useCallback } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Loader, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAnalytics } from '../AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';
import { SongDetailSheet } from '../admin-detail-sheets';
import { AddSongDialog } from '../AddSongDialog';
import { AdminPageHeader, AdminCard, StatGrid, StatTile } from '../admin-ui';
import {
    type Song, type SongAnalytics,
    fmtDuration, fmtDateShort, fmtDateLong, fmtDateTimeInput,
    sortByDateAsc, getAxiosErrorMessage,
} from '../admin-shared';

const SortHeader = ({ label, active, dir, onClick }: {
    label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'flex items-center gap-1 text-left transition-colors hover:text-white',
            active ? 'text-emerald-400' : 'text-zinc-500',
        )}
    >
        {label}
        {active && <span className="text-[9px]">{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
);

export const SongsSection = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [detailSongId, setDetailSongId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [songTotal, setSongTotal] = useState(0);
    const [songPage, setSongPage] = useState(1);
    const [songPages, setSongPages] = useState(1);
    const [songSearch, setSongSearch] = useState('');
    const [songSort, setSongSort] = useState<'createdAt' | 'title' | 'artist' | 'duration' | 'streamCount' | 'uniquePlays' | 'skipCount'>('createdAt');
    const [songSortDir, setSongSortDir] = useState<'asc' | 'desc'>('desc');
    const [songFilter, setSongFilter] = useState<'' | 'missingImage' | 'missingArtist' | 'short'>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [songAnalytics, setSongAnalytics] = useState<SongAnalytics | null>(null);
    const [songAnalyticsLoading, setSongAnalyticsLoading] = useState(true);
    const [songAnalyticsRefreshTick, setSongAnalyticsRefreshTick] = useState(0);
    const { data: an, loading: anLoading } = useAnalytics();

    const [artistOpts, setArtistOpts] = useState<{ _id: string; name: string }[]>([]);
    const [albumOpts, setAlbumOpts] = useState<{ _id: string; title: string }[]>([]);
    useEffect(() => {
        axiosInstance.get('/admin/artists').then(r => setArtistOpts(r.data.data ?? [])).catch(() => { });
        axiosInstance.get('/admin/albums').then(r => setAlbumOpts(r.data.data ?? [])).catch(() => { });
    }, []);

    const fetchSongs = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosInstance.get('/admin/songs', {
                params: {
                    page: songPage, limit: 50,
                    search: songSearch || undefined,
                    sort: songSort, dir: songSortDir,
                    filter: songFilter || undefined,
                },
            });
            setSongs(data.data);
            setSongTotal(data.total ?? data.data.length);
            setSongPages(data.pages ?? 1);
        } catch {
            toast.error('Failed to load songs');
        } finally {
            setLoading(false);
        }
    }, [songPage, songSearch, songSort, songSortDir, songFilter]);

    useEffect(() => { fetchSongs(); }, [fetchSongs]);

    useEffect(() => {
        if (!an?.from || !an?.to) return;
        let canceled = false;
        const loadSongAnalytics = async () => {
            setSongAnalyticsLoading(true);
            try {
                const { data } = await axiosInstance.get('/admin/analytics/songs', {
                    params: { from: an.from, to: an.to, granularity: an.granularity },
                });
                if (!canceled) setSongAnalytics(data.data);
            } catch (error) {
                if (!canceled) toast.error(getAxiosErrorMessage(error, 'Failed to load song analytics'));
            } finally {
                if (!canceled) setSongAnalyticsLoading(false);
            }
        };
        void loadSongAnalytics();
        return () => { canceled = true; };
    }, [an?.from, an?.to, an?.granularity, songAnalyticsRefreshTick]);

    const refreshAfterUpload = async () => {
        await fetchSongs();
        setSongAnalyticsRefreshTick(t => t + 1);
    };

    const deleteSong = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            await axiosInstance.delete(`/admin/songs/${id}`);
            setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            await fetchSongs();
            setSongAnalyticsRefreshTick(t => t + 1);
            toast.success('Song deleted');
        } catch (error) {
            toast.error(getAxiosErrorMessage(error, 'Delete failed'));
        }
    };
    // const editSong = ()

    const bulkDelete = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} song(s)? This cannot be undone.`)) return;
        setBulkDeleting(true);
        try {
            const { data } = await axiosInstance.post('/admin/songs/bulk-delete', { ids });
            toast.success(`Deleted ${data.deleted} song(s)`);
            setSelectedIds(new Set());
            await fetchSongs();
            setSongAnalyticsRefreshTick(t => t + 1);
        } catch (error) {
            toast.error(getAxiosErrorMessage(error, 'Bulk delete failed'));
        } finally {
            setBulkDeleting(false);
        }
    };

    const toggleSort = (key: typeof songSort) => {
        if (songSort === key) setSongSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSongSort(key); setSongSortDir('desc'); }
        setSongPage(1);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            if (songs.every(s => prev.has(s._id))) return new Set();
            return new Set(songs.map(s => s._id));
        });
    };

    const playsPerPeriod = sortByDateAsc(songAnalytics?.playsPerPeriod ?? songAnalytics?.playsPerDay ?? []);
    const topSongs = songAnalytics?.topSongs ?? [];
    const skipRates = songAnalytics?.skipRates ?? [];
    const geoBreakdown = songAnalytics?.geoBreakdown ?? [];
    const summary = songAnalytics?.summary ?? { plays: 0, streams: 0, skippedPlays: 0, activeSongs: 0 };
    const avgStreamsPerPlay = summary.plays > 0 ? (summary.streams / summary.plays).toFixed(2) : '0.00';
    const overallSkipRate = summary.plays > 0 ? ((summary.skippedPlays / summary.plays) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Library"
                title="Songs"
                description="Upload tracks, manage metadata, and monitor playback performance."
                actions={<AddSongDialog onUploaded={refreshAfterUpload} artists={artistOpts} albums={albumOpts} />}
            />
            <div>Eff</div>

            {!anLoading && an && (
                <div className="space-y-4">
                    <StatGrid className="lg:grid-cols-5">
                        <StatTile label="Plays" value={summary.plays.toLocaleString()} accent="zinc" />
                        <StatTile label="Streams" value={summary.streams.toLocaleString()} accent="violet" />
                        <StatTile label="Avg /play" value={avgStreamsPerPlay} accent="emerald" />
                        <StatTile label="Skip rate" value={`${overallSkipRate}%`} accent="amber" />
                        <StatTile label="Active songs" value={summary.activeSongs.toLocaleString()} accent="sky" />
                    </StatGrid>
                    <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
                        Song analytics range: {songAnalytics ? `${fmtDateTimeInput(songAnalytics.from)} → ${fmtDateTimeInput(songAnalytics.to)} (${songAnalytics.granularity})` : `${fmtDateTimeInput(an.from)} → ${fmtDateTimeInput(an.to)} (${an.granularity})`}
                    </p>

                    {songAnalyticsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading song analytics...</div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <ChartCard title="Playback trend (plays vs streams)">
                                {playsPerPeriod.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={playsPerPeriod}>
                                            <defs>
                                                <linearGradient id="songPlays" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.signups} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.signups} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="songStreams" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis yAxisId="plays" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis yAxisId="streams" orientation="right" tick={AXIS_STYLE} allowDecimals={false} />
                                            <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                            <Area yAxisId="plays" type="monotone" dataKey="plays" name="Plays" stroke={CHART_COLORS.signups} fill="url(#songPlays)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="streams" type="monotone" dataKey="streams" name="Streams" stroke={CHART_COLORS.revenue} fill="url(#songStreams)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Top streamed songs">
                                {topSongs.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={Math.max(180, Math.min(10, topSongs.length) * 30)}>
                                        <BarChart data={topSongs.slice(0, 10)} layout="vertical" barCategoryGap="26%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                            <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="title"
                                                tick={{ ...AXIS_STYLE, fontSize: 11 }}
                                                width={130}
                                                tickFormatter={(value) => String(value).length > 22 ? `${String(value).slice(0, 22)}…` : String(value)}
                                            />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                formatter={(value, name, payload) => {
                                                    if (name === 'streams') {
                                                        const song = payload?.payload as SongAnalytics['topSongs'][number];
                                                        return [`${Number(value).toLocaleString()} streams · ${song.plays.toLocaleString()} plays`, `${song.artist}`];
                                                    }
                                                    return [value, name];
                                                }}
                                            />
                                            <Bar dataKey="streams" name="streams" fill={CHART_COLORS.revenue} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Skip rate by song">
                                {skipRates.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={skipRates.slice(0, 10)} barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="title" tick={AXIS_STYLE} tickFormatter={(value) => String(value).length > 16 ? `${String(value).slice(0, 16)}…` : String(value)} />
                                            <YAxis tick={AXIS_STYLE} tickFormatter={(value) => `${value}%`} />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                formatter={(value, _name, payload) => {
                                                    const row = payload?.payload as SongAnalytics['skipRates'][number];
                                                    return [`${Number(value)}%`, `${row.artist} · ${row.plays} plays`];
                                                }}
                                            />
                                            <Bar dataKey="skipRate" name="Skip rate" fill={CHART_COLORS.donations} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Streams by country">
                                {geoBreakdown.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={geoBreakdown} dataKey="streams" nameKey="country" outerRadius={76} innerRadius={44} paddingAngle={2}>
                                                {geoBreakdown.map((entry, idx) => (
                                                    <Cell key={`${entry.country}-${idx}`} fill={['#a78bfa', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#22d3ee', '#fb7185', '#a3e635'][idx % 8]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={TIP_STYLE} formatter={(value) => [Number(value).toLocaleString(), 'Streams']} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    )}

                    <ChartCard title="Top artists by song count">
                        {an.topArtists.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={Math.max(120, an.topArtists.length * 28)}>
                                <BarChart data={an.topArtists} layout="vertical" barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                    <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                                    <YAxis type="category" dataKey="artist" tick={{ ...AXIS_STYLE, fontSize: 11 }} width={90} />
                                    <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="songs" name="Songs" fill={CHART_COLORS.revenue} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            <AdminCard padding="tight" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder="Search title or artist…"
                        value={songSearch}
                        onChange={e => { setSongSearch(e.target.value); setSongPage(1); }}
                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <select
                        value={songFilter}
                        onChange={e => { setSongFilter(e.target.value as typeof songFilter); setSongPage(1); }}
                        className="bg-white/5 border border-white/10 text-white text-xs h-8 rounded-md px-2"
                    >
                        <option value="">All songs</option>
                        <option value="missingImage">Missing image</option>
                        <option value="missingArtist">Missing artist</option>
                        <option value="short">Short ({'<'} 30s)</option>
                    </select>
                    <span className="text-xs text-zinc-500">{songTotal.toLocaleString()} total</span>
                    {selectedIds.size > 0 && (
                        <Button
                            size="sm"
                            onClick={bulkDelete}
                            disabled={bulkDeleting}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 gap-1.5 ml-auto"
                        >
                            {bulkDeleting ? <Loader className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                            Delete {selectedIds.size}
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>
                ) : (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="grid grid-cols-[36px_36px_1fr_140px_60px_70px_70px_60px_36px] items-center gap-2 px-3 py-2 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
                            <div>
                                <input
                                    type="checkbox"
                                    checked={songs.length > 0 && songs.every(s => selectedIds.has(s._id))}
                                    onChange={toggleSelectAll}
                                />
                            </div>
                            <div></div>
                            <SortHeader label="Title" active={songSort === 'title'} dir={songSortDir} onClick={() => toggleSort('title')} />
                            <SortHeader label="Artist" active={songSort === 'artist'} dir={songSortDir} onClick={() => toggleSort('artist')} />
                            <SortHeader label="Length" active={songSort === 'duration'} dir={songSortDir} onClick={() => toggleSort('duration')} />
                            <SortHeader label="Plays" active={songSort === 'uniquePlays'} dir={songSortDir} onClick={() => toggleSort('uniquePlays')} />
                            <SortHeader label="Streams" active={songSort === 'streamCount'} dir={songSortDir} onClick={() => toggleSort('streamCount')} />
                            <SortHeader label="Skips" active={songSort === 'skipCount'} dir={songSortDir} onClick={() => toggleSort('skipCount')} />
                            <div></div>
                        </div>

                        {songs.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-zinc-600">No songs match.</div>
                        )}
                        {songs.map((s) => (
                            <div
                                key={s._id}
                                className={cn(
                                    'grid grid-cols-[36px_36px_1fr_140px_60px_70px_70px_60px_36px] items-center gap-2 px-3 py-2 border-t border-white/5 text-xs',
                                    selectedIds.has(s._id) && 'bg-emerald-500/5',
                                )}
                            >
                                <input type="checkbox" checked={selectedIds.has(s._id)} onChange={() => toggleSelect(s._id)} />
                                <img src={s.imageUrl} className="size-7 rounded object-cover cursor-pointer" onClick={() => setDetailSongId(s._id)} />
                                <button onClick={() => setDetailSongId(s._id)} className="text-white truncate text-left hover:underline">{s.title}</button>
                                <p className="text-zinc-400 truncate">{s.artist}</p>
                                <span className="text-zinc-500 tabular-nums">{fmtDuration(s.duration)}</span>
                                <span className="text-zinc-400 tabular-nums">{(s.uniquePlays ?? 0).toLocaleString()}</span>
                                <span className="text-zinc-400 tabular-nums">{(s.streamCount ?? 0).toLocaleString()}</span>
                                <span className="text-zinc-500 tabular-nums">{(s.skipCount ?? 0).toLocaleString()}</span>
                                <Button
                                    size="sm" variant="ghost"
                                    onClick={() => deleteSong(s._id, s.title)}
                                    className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 size-7 p-0"
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {songPages > 1 && (
                    <div className="flex items-center justify-center gap-2 text-xs">
                        <Button size="sm" variant="ghost" disabled={songPage <= 1} onClick={() => setSongPage(p => p - 1)}>
                            <ChevronLeft className="size-3.5" />
                        </Button>
                        <span className="text-zinc-500">Page {songPage} / {songPages}</span>
                        <Button size="sm" variant="ghost" disabled={songPage >= songPages} onClick={() => setSongPage(p => p + 1)}>
                            <ChevronRight className="size-3.5" />
                        </Button>
                    </div>
                )}
            </AdminCard>
            <SongDetailSheet id={detailSongId} onClose={() => setDetailSongId(null)} />
        </div>
    );
};
