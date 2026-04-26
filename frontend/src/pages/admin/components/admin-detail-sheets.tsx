// Detail Sheets for Song / Artist / Album rows in the admin tables.
// Each sheet fetches the populated detail endpoint on open and renders
// a rich read-only summary built from the new metadata fields.

import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import {
    Music2, Disc3, User, Calendar, Clock, Headphones, SkipForward,
    Tag, Sparkles, Globe, X,
} from 'lucide-react';
import { AdminLoading, Chip, InfoRow, AdminDivider } from './admin-ui';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const fmtNumber = (n?: number | null) =>
    typeof n === 'number' ? n.toLocaleString() : '—';

interface SheetShellProps {
    open: boolean;
    onClose: () => void;
    title: string;
    eyebrow: string;
    children: React.ReactNode;
}

const SheetShell = ({ open, onClose, title, eyebrow, children }: SheetShellProps) => (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
            side="right"
            className="w-full sm:w-[440px] border-l border-white/10 p-0 overflow-y-auto hide-scrollbar"
            style={{ background: 'var(--ink-1)' }}>
            <div className="sticky top-0 z-10 px-5 py-4 backdrop-blur-md flex items-start justify-between gap-3"
                 style={{ background: 'color-mix(in oklab, var(--ink-1) 88%, transparent)', borderBottom: '1px solid color-mix(in oklab, white 8%, transparent)' }}>
                <div className="min-w-0">
                    <p className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>{eyebrow}</p>
                    <h2 className="serif text-white text-xl mt-0.5 truncate">{title}</h2>
                </div>
                <button
                    onClick={onClose}
                    className="size-8 shrink-0 rounded-lg ring-1 ring-white/10 flex items-center justify-center hover:bg-white/5 press"
                    aria-label="Close">
                    <X className="size-4" style={{ color: 'var(--fg-2)' }} />
                </button>
            </div>
            <div className="p-5">{children}</div>
        </SheetContent>
    </Sheet>
);

// ── Song detail ───────────────────────────────────────────────────────────────

interface SongDetailData {
    _id: string;
    title: string;
    artist: string;
    imageUrl: string;
    duration: number;
    description?: string;
    genre?: string[];
    mood?: string[];
    tags?: string[];
    language?: string;
    bpm?: number | null;
    musicalKey?: string | null;
    explicit?: boolean;
    releaseDate?: string | null;
    originalArtist?: string;
    license?: string;
    isrc?: string;
    energy?: number | null;
    danceability?: number | null;
    valence?: number | null;
    streamCount?: number;
    uniquePlays?: number;
    skipCount?: number;
    createdAt?: string;
    artistId?: { _id: string; name: string } | null;
    albumId?: { _id: string; title: string } | null;
}

interface DetailSheetProps {
    id: string | null;
    onClose: () => void;
}

export const SongDetailSheet = ({ id, onClose }: DetailSheetProps) => {
    const [data, setData] = useState<SongDetailData | null>(null);
    const [trend, setTrend] = useState<{ date: string; plays: number }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!id) { setData(null); setTrend([]); return; }
        let canceled = false;
        setLoading(true);
        axiosInstance.get(`/admin/songs/${id}`)
            .then(r => { if (!canceled) { setData(r.data.data?.song ?? r.data.data); setTrend(r.data.data?.playTrend ?? []); } })
            .catch(() => { if (!canceled) toast.error('Failed to load song'); })
            .finally(() => { if (!canceled) setLoading(false); });
        return () => { canceled = true; };
    }, [id]);

    return (
        <SheetShell open={!!id} onClose={onClose} eyebrow="Song" title={data?.title ?? 'Loading…'}>
            {loading && <AdminLoading />}
            {!loading && data && (
                <>
                    {/* Hero — cover + title block */}
                    <div className="flex gap-4">
                        <img src={data.imageUrl} alt={data.title}
                             className="w-24 h-24 rounded-xl object-cover ring-1 ring-white/10 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm" style={{ color: 'var(--fg-2)' }}>{data.artist}</p>
                            {data.albumId && (
                                <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--fg-3)' }}>
                                    <Disc3 className="size-3" /> {data.albumId.title}
                                </p>
                            )}
                            <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--fg-3)' }}>
                                <Clock className="size-3" /> {fmtDuration(data.duration)}
                                {data.explicit && <span className="ml-2 px-1 rounded bg-rose-500/15 text-rose-300 text-[9px] font-bold">E</span>}
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    {data.description && (
                        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                            {data.description}
                        </p>
                    )}

                    {/* Genres + Moods + Tags */}
                    {((data.genre && data.genre.length) || (data.mood && data.mood.length) || (data.tags && data.tags.length)) && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                            {data.genre?.map(g => <Chip key={'g' + g} tone="violet" icon={Sparkles}>{g}</Chip>)}
                            {data.mood?.map(m => <Chip key={'m' + m} tone="amber">{m}</Chip>)}
                            {data.tags?.map(t => <Chip key={'t' + t} tone="zinc" icon={Tag}>{t}</Chip>)}
                        </div>
                    )}

                    <AdminDivider label="Metadata" />
                    <div className="space-y-0.5">
                        <InfoRow label="BPM">{data.bpm ?? '—'}</InfoRow>
                        <InfoRow label="Key">{data.musicalKey ?? '—'}</InfoRow>
                        <InfoRow label="Language">{data.language || '—'}</InfoRow>
                        <InfoRow label="Released">{fmtDate(data.releaseDate)}</InfoRow>
                        {data.originalArtist && <InfoRow label="Cover of">{data.originalArtist}</InfoRow>}
                        {data.license && <InfoRow label="License">{data.license}</InfoRow>}
                        {data.isrc && <InfoRow label="ISRC">{data.isrc}</InfoRow>}
                    </div>

                    {(data.energy != null || data.danceability != null || data.valence != null) && (
                        <>
                            <AdminDivider label="Audio Features" />
                            <div className="space-y-2.5">
                                <FeatureBar label="Energy" value={data.energy} />
                                <FeatureBar label="Danceability" value={data.danceability} />
                                <FeatureBar label="Valence" value={data.valence} />
                            </div>
                        </>
                    )}

                    <AdminDivider label="Performance" />
                    <div className="grid grid-cols-3 gap-2">
                        <MiniStat icon={Headphones} label="Streams"   value={fmtNumber(data.streamCount)} />
                        <MiniStat icon={User}       label="Uniques"  value={fmtNumber(data.uniquePlays)} />
                        <MiniStat icon={SkipForward} label="Skips"   value={fmtNumber(data.skipCount)} />
                    </div>

                    {trend.length > 0 && (
                        <>
                            <AdminDivider label="Last 30 days" />
                            <Sparkline data={trend} />
                        </>
                    )}

                    <p className="mt-5 text-[10px] mono uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>
                        Created {fmtDate(data.createdAt)}
                    </p>
                </>
            )}
        </SheetShell>
    );
};

// ── Artist detail ─────────────────────────────────────────────────────────────

interface ArtistDetailData {
    _id: string;
    name: string;
    imageUrl?: string;
    bio?: string;
    country?: string;
    genres?: string[];
    monthlyListeners?: number;
    createdAt?: string;
    albums?: { _id: string; title: string; imageUrl?: string; releaseYear?: number }[];
    songs?: { _id: string; title: string; duration: number; streamCount?: number }[];
    totals?: { songCount: number; albumCount: number; totalPlays: number };
}

export const ArtistDetailSheet = ({ id, onClose }: DetailSheetProps) => {
    const [data, setData] = useState<ArtistDetailData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!id) { setData(null); return; }
        let canceled = false;
        setLoading(true);
        axiosInstance.get(`/admin/artists/${id}`)
            .then(r => { if (!canceled) setData(r.data.data); })
            .catch(() => { if (!canceled) toast.error('Failed to load artist'); })
            .finally(() => { if (!canceled) setLoading(false); });
        return () => { canceled = true; };
    }, [id]);

    return (
        <SheetShell open={!!id} onClose={onClose} eyebrow="Artist" title={data?.name ?? 'Loading…'}>
            {loading && <AdminLoading />}
            {!loading && data && (
                <>
                    <div className="flex gap-4">
                        {data.imageUrl ? (
                            <img src={data.imageUrl} alt={data.name} className="w-24 h-24 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                                <User className="size-8" style={{ color: 'var(--fg-3)' }} />
                            </div>
                        )}
                        <div className="min-w-0">
                            {data.country && <p className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--fg-3)' }}><Globe className="size-3" /> {data.country}</p>}
                            <p className="text-2xl serif text-white mt-1">{fmtNumber(data.monthlyListeners)}</p>
                            <p className="text-[10px] mono uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>monthly listeners</p>
                        </div>
                    </div>

                    {data.bio && <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--fg-2)' }}>{data.bio}</p>}

                    {data.genres && data.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {data.genres.map(g => <Chip key={g} tone="violet" icon={Sparkles}>{g}</Chip>)}
                        </div>
                    )}

                    <AdminDivider label="Catalog" />
                    <div className="grid grid-cols-3 gap-2">
                        <MiniStat icon={Music2} label="Songs"  value={fmtNumber(data.totals?.songCount)} />
                        <MiniStat icon={Disc3}  label="Albums" value={fmtNumber(data.totals?.albumCount)} />
                        <MiniStat icon={Headphones} label="Plays" value={fmtNumber(data.totals?.totalPlays)} />
                    </div>

                    {data.albums && data.albums.length > 0 && (
                        <>
                            <AdminDivider label={`Albums · ${data.albums.length}`} />
                            <div className="grid grid-cols-3 gap-2">
                                {data.albums.slice(0, 9).map(a => (
                                    <div key={a._id} className="min-w-0">
                                        {a.imageUrl ? (
                                            <img src={a.imageUrl} alt={a.title} className="aspect-square w-full rounded-lg object-cover ring-1 ring-white/10" />
                                        ) : (
                                            <div className="aspect-square w-full rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                                                <Disc3 className="size-5" style={{ color: 'var(--fg-3)' }} />
                                            </div>
                                        )}
                                        <p className="text-[11px] text-white mt-1 truncate">{a.title}</p>
                                        {a.releaseYear && <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>{a.releaseYear}</p>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {data.songs && data.songs.length > 0 && (
                        <>
                            <AdminDivider label={`Top tracks · ${data.songs.length}`} />
                            <div className="space-y-1">
                                {data.songs.slice(0, 8).map((s, i) => (
                                    <div key={s._id} className="flex items-center gap-3 py-1.5 text-xs">
                                        <span className="mono w-5 shrink-0 text-right" style={{ color: 'var(--fg-3)' }}>{i + 1}</span>
                                        <span className="flex-1 truncate text-white">{s.title}</span>
                                        <span className="tabular-nums" style={{ color: 'var(--fg-3)' }}>{fmtNumber(s.streamCount)}</span>
                                        <span className="tabular-nums w-10 text-right" style={{ color: 'var(--fg-3)' }}>{fmtDuration(s.duration)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <p className="mt-5 text-[10px] mono uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>
                        Added {fmtDate(data.createdAt)}
                    </p>
                </>
            )}
        </SheetShell>
    );
};

// ── Album detail ──────────────────────────────────────────────────────────────

interface AlbumDetailData {
    _id: string;
    title: string;
    imageUrl?: string;
    description?: string;
    releaseYear?: number;
    label?: string;
    artistId?: { _id: string; name: string } | null;
    createdAt?: string;
    songs?: { _id: string; title: string; duration: number; streamCount?: number }[];
    totals?: { songCount: number; totalDuration: number; totalPlays: number };
}

export const AlbumDetailSheet = ({ id, onClose }: DetailSheetProps) => {
    const [data, setData] = useState<AlbumDetailData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!id) { setData(null); return; }
        let canceled = false;
        setLoading(true);
        axiosInstance.get(`/admin/albums/${id}`)
            .then(r => { if (!canceled) setData(r.data.data); })
            .catch(() => { if (!canceled) toast.error('Failed to load album'); })
            .finally(() => { if (!canceled) setLoading(false); });
        return () => { canceled = true; };
    }, [id]);

    return (
        <SheetShell open={!!id} onClose={onClose} eyebrow="Album" title={data?.title ?? 'Loading…'}>
            {loading && <AdminLoading />}
            {!loading && data && (
                <>
                    <div className="flex gap-4">
                        {data.imageUrl ? (
                            <img src={data.imageUrl} alt={data.title} className="w-28 h-28 rounded-xl object-cover ring-1 ring-white/10 shrink-0" />
                        ) : (
                            <div className="w-28 h-28 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                                <Disc3 className="size-8" style={{ color: 'var(--fg-3)' }} />
                            </div>
                        )}
                        <div className="min-w-0">
                            {data.artistId && <p className="text-sm" style={{ color: 'var(--fg-2)' }}>{data.artistId.name}</p>}
                            {data.releaseYear && (
                                <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--fg-3)' }}>
                                    <Calendar className="size-3" /> {data.releaseYear}
                                </p>
                            )}
                            {data.label && <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>{data.label}</p>}
                        </div>
                    </div>

                    {data.description && <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--fg-2)' }}>{data.description}</p>}

                    <AdminDivider label="Stats" />
                    <div className="grid grid-cols-3 gap-2">
                        <MiniStat icon={Music2} label="Tracks" value={fmtNumber(data.totals?.songCount)} />
                        <MiniStat icon={Clock}  label="Length" value={data.totals ? fmtDuration(data.totals.totalDuration) : '—'} />
                        <MiniStat icon={Headphones} label="Plays" value={fmtNumber(data.totals?.totalPlays)} />
                    </div>

                    {data.songs && data.songs.length > 0 && (
                        <>
                            <AdminDivider label={`Tracklist · ${data.songs.length}`} />
                            <div className="space-y-1">
                                {data.songs.map((s, i) => (
                                    <div key={s._id} className="flex items-center gap-3 py-1.5 text-xs">
                                        <span className="mono w-5 shrink-0 text-right" style={{ color: 'var(--fg-3)' }}>{i + 1}</span>
                                        <span className="flex-1 truncate text-white">{s.title}</span>
                                        <span className="tabular-nums" style={{ color: 'var(--fg-3)' }}>{fmtNumber(s.streamCount)}</span>
                                        <span className="tabular-nums w-10 text-right" style={{ color: 'var(--fg-3)' }}>{fmtDuration(s.duration)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <p className="mt-5 text-[10px] mono uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>
                        Added {fmtDate(data.createdAt)}
                    </p>
                </>
            )}
        </SheetShell>
    );
};

// ── Tiny inline helpers ───────────────────────────────────────────────────────

const FeatureBar = ({ label, value }: { label: string; value?: number | null }) => {
    const v = value ?? 0;
    const pct = Math.round(v * 100);
    return (
        <div>
            <div className="flex justify-between text-[11px] mb-0.5">
                <span style={{ color: 'var(--fg-3)' }}>{label}</span>
                <span className="tabular-nums" style={{ color: 'var(--fg-2)' }}>{value == null ? '—' : `${pct}%`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-[oklch(0.88_0.12_75)] transition-all"
                     style={{ width: `${value == null ? 0 : pct}%` }} />
            </div>
        </div>
    );
};

const MiniStat = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
    <div className="rounded-lg ring-1 ring-white/10 p-2.5" style={{ background: 'var(--ink-2)' }}>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>
            <Icon className="size-3" /> {label}
        </div>
        <p className="text-sm font-semibold text-white tabular-nums mt-0.5">{value}</p>
    </div>
);

const Sparkline = ({ data }: { data: { date: string; plays: number }[] }) => {
    if (data.length === 0) return null;
    const max = Math.max(...data.map(d => d.plays), 1);
    return (
        <div className="flex items-end gap-0.5 h-16">
            {data.map((d, i) => (
                <div key={i} className={cn('flex-1 rounded-sm transition-colors', d.plays > 0 ? 'bg-[oklch(0.88_0.12_75)]' : 'bg-white/5')}
                     style={{ height: `${Math.max((d.plays / max) * 100, 4)}%` }}
                     title={`${d.date}: ${d.plays} plays`} />
            ))}
        </div>
    );
};
