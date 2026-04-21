import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Users, Radio, Loader2, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { getPublicRooms, getTagCounts } from '@/lib/roomService'
import type { RoomInfo } from '@/types/types'
import { cn } from '@/lib/utils'

// ── Tag gradient palette — one per mood ───────────────────────────────────────

const TAG_GRADIENTS: Record<string, string> = {
    'Late Night':  'linear-gradient(145deg, oklch(0.18 0.05 230), oklch(0.12 0.03 250))',
    'Ambient':     'linear-gradient(145deg, oklch(0.18 0.04 255), oklch(0.12 0.03 270))',
    'Indie':       'linear-gradient(145deg, oklch(0.18 0.05 270), oklch(0.12 0.04 280))',
    'R&B':         'linear-gradient(145deg, oklch(0.18 0.07 295), oklch(0.12 0.05 305))',
    'Focus':       'linear-gradient(145deg, oklch(0.18 0.06 305), oklch(0.12 0.05 320))',
    'Hype':        'linear-gradient(145deg, oklch(0.2 0.07 330), oklch(0.14 0.05 345))',
    'Chill':       'linear-gradient(145deg, oklch(0.18 0.06 0),   oklch(0.13 0.05 340))',
    'Jazz':        'linear-gradient(145deg, oklch(0.18 0.06 10),  oklch(0.12 0.04 355))',
    'Electronic':  'linear-gradient(145deg, oklch(0.18 0.06 15),  oklch(0.12 0.04 5))',
    'Acoustic':    'linear-gradient(145deg, oklch(0.18 0.06 30),  oklch(0.12 0.04 15))',
    'Soul':        'linear-gradient(145deg, oklch(0.18 0.06 40),  oklch(0.13 0.05 25))',
    'Lo-fi':       'linear-gradient(145deg, oklch(0.18 0.04 225), oklch(0.13 0.04 240))',
    'Pop':         'linear-gradient(145deg, oklch(0.2 0.07 320),  oklch(0.14 0.05 335))',
    'Hip-Hop':     'linear-gradient(145deg, oklch(0.18 0.06 285), oklch(0.13 0.05 295))',
    'Classical':   'linear-gradient(145deg, oklch(0.18 0.03 240), oklch(0.13 0.02 255))',
    'Country':     'linear-gradient(145deg, oklch(0.18 0.05 45),  oklch(0.13 0.04 30))',
    'Reggae':      'linear-gradient(145deg, oklch(0.18 0.06 150), oklch(0.13 0.04 140))',
    'Metal':       'linear-gradient(145deg, oklch(0.16 0.02 270), oklch(0.10 0.01 260))',
}

const TAG_ORDER = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi', 'Pop', 'Hip-Hop', 'Classical', 'Country', 'Reggae', 'Metal']

const SORT_OPTIONS = [
    { value: 'listeners', label: 'Most listeners' },
    { value: 'newest',    label: 'Newest' },
    { value: 'donations', label: 'Most donated' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['value']

const PAGE_SIZE = 12

// ── Room card ──────────────────────────────────────────────────────────────────

const RoomCard = ({ room }: { room: RoomInfo }) => {
    const navigate = useNavigate()
    const isLive   = room.status === 'live'
    const song     = room.playlist[room.playback?.currentSongIndex ?? 0]
    // || instead of ?? — catches empty strings in addition to null/undefined
    const cover    = room.coverImageUrl || song?.imageUrl || null

    return (
        <button
            onClick={() => navigate(`/rooms/${room._id}`)}
            className="group text-left rounded-2xl overflow-hidden ring-1 ring-white/8 hover:ring-white/20 transition-all press"
            style={{ background: 'var(--ink-2)' }}
        >
            {/* Cover */}
            <div className="aspect-[4/3] relative overflow-hidden" style={{ background: 'var(--ink-1)' }}>
                {cover ? (
                    <img src={cover} alt={room.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full grid place-items-center">
                        <Radio className="size-8" style={{ color: 'var(--fg-3)' }} />
                    </div>
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, oklch(0.08 0.015 285 / 0.9) 100%)' }} />

                {isLive ? (
                    <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 mono text-[9px] font-bold text-white px-2.5 py-1 rounded-full"
                        style={{ background: 'oklch(0.72 0.22 20 / 0.9)' }}>
                        <span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE
                    </span>
                ) : (
                    <span className="absolute top-2.5 left-2.5 mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{ background: 'oklch(0.1 0.01 285 / 0.7)', color: 'var(--fg-3)' }}>
                        Offline
                    </span>
                )}

                {/* Tags */}
                {room.tags && room.tags.length > 0 && (
                    <div className="absolute bottom-2.5 left-2.5 flex gap-1 flex-wrap">
                        {room.tags.slice(0, 2).map(t => (
                            <span key={t} className="mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ background: 'oklch(0.1 0.01 285 / 0.8)', color: 'var(--fg-2)' }}>
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3.5 space-y-1.5">
                <p className="text-[14px] font-semibold text-white truncate leading-tight">{room.title}</p>
                {song && <p className="mono text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>{song.title} — {song.artist}</p>}

                <div className="flex items-center gap-3 mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
                    {isLive && (
                        <span className="flex items-center gap-1 text-[oklch(0.82_0.17_20)]">
                            <Users className="size-3" />
                            {(room.listenerCount ?? 0).toLocaleString()}
                        </span>
                    )}
                    {room.streamGoal > 0 && (
                        <span className="flex items-center gap-1">
                            💎 {room.streamGoalCurrent.toLocaleString()}/{room.streamGoal.toLocaleString()}
                        </span>
                    )}
                </div>

                {room.streamGoal > 0 && (
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-1)' }}>
                        <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (room.streamGoalCurrent / room.streamGoal) * 100)}%`,
                            background: 'oklch(0.88 0.12 75)',
                        }} />
                    </div>
                )}
            </div>
        </button>
    )
}

// ── Mood grid card ─────────────────────────────────────────────────────────────

const MoodCard = ({ tag, count, active, onClick }: { tag: string; count: number; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn('relative rounded-2xl overflow-hidden text-left press transition-all', active ? 'ring-2 ring-white/60' : 'ring-1 ring-white/10 hover:ring-white/25')}
        style={{ background: TAG_GRADIENTS[tag] ?? 'var(--ink-2)', aspectRatio: '4/3' }}
    >
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
            <p className="mono text-[9px] uppercase tracking-widest text-white/50 text-right">{count} rooms</p>
            <p className="serif italic text-white" style={{ fontSize: 22, lineHeight: 1.1 }}>{tag}</p>
        </div>
    </button>
)

// ── Page ──────────────────────────────────────────────────────────────────────

const RoomsPage = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const initTags = searchParams.get('tags')?.split(',').filter(Boolean) ?? []

    const [rooms, setRooms]             = useState<RoomInfo[]>([])
    const [loading, setLoading]         = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore]         = useState(false)
    const [offset, setOffset]           = useState(0)
    const [search, setSearch]           = useState('')
    const [sort, setSort]               = useState<SortOption>('listeners')
    const [activeTags, setActiveTags]   = useState<string[]>(initTags)
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [tagCounts, setTagCounts]     = useState<{ tag: string; count: number }[]>([])
    const [showMoodGrid, setShowMoodGrid] = useState(initTags.length === 0)

    useEffect(() => {
        getTagCounts().then(setTagCounts).catch(() => {})
    }, [])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350)
        return () => clearTimeout(t)
    }, [search])

    const fetchRooms = useCallback(async (newOffset = 0, replace = true) => {
        if (newOffset === 0) setLoading(true)
        else setLoadingMore(true)
        try {
            const result = await getPublicRooms({
                sort,
                search: debouncedSearch || undefined,
                tags: activeTags.length ? activeTags.join(',') : undefined,
                limit: PAGE_SIZE,
                offset: newOffset,
            })
            const list: RoomInfo[] = result.data ?? result
            setRooms(prev => replace ? list : [...prev, ...list])
            setHasMore((result.total ?? 0) > newOffset + list.length)
            setOffset(newOffset)
        } catch { /* keep existing list */ }
        finally { setLoading(false); setLoadingMore(false) }
    }, [sort, debouncedSearch, activeTags])

    useEffect(() => { fetchRooms(0, true) }, [fetchRooms])

    const toggleTag = (tag: string) => {
        setActiveTags(prev => {
            const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            setSearchParams(next.length ? { tags: next.join(',') } : {})
            if (next.length > 0) setShowMoodGrid(false)
            return next
        })
    }

    const removeTag = (tag: string) => toggleTag(tag)

    const clearAllTags = () => {
        setActiveTags([])
        setShowMoodGrid(true)
        setSearchParams({})
    }

    const countFor = (tag: string) => tagCounts.find(t => t.tag === tag)?.count ?? 0
    const liveRooms    = rooms.filter(r => r.status === 'live')
    const offlineRooms = rooms.filter(r => r.status !== 'live')

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-10" style={{ color: 'var(--fg-1)' }}>

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                    <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Discovery</p>
                    <h1 className="serif italic text-white" style={{ fontSize: 34 }}>Live Rooms</h1>
                </div>

                {/* Sort + search row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--fg-3)' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search rooms…"
                            className="pl-9 pr-3 h-9 rounded-xl ring-1 ring-white/10 text-[13px] text-white outline-none w-48"
                            style={{ background: 'var(--ink-2)', color: 'var(--fg-1)' }}
                        />
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-xl ring-1 ring-white/8" style={{ background: 'var(--ink-2)' }}>
                        <SlidersHorizontal className="size-3.5 ml-1 mr-0.5 shrink-0" style={{ color: 'var(--fg-3)' }} />
                        {SORT_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setSort(opt.value)}
                                className={cn('mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all press',
                                    sort === opt.value ? 'bg-white/10 text-white ring-1 ring-white/10' : 'hover:text-white'
                                )}
                                style={{ color: sort === opt.value ? undefined : 'var(--fg-3)' }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Mood grid ── */}
            {showMoodGrid && !debouncedSearch && activeTags.length === 0 && (
                <section className="space-y-4">
                    <div>
                        <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>By mood</p>
                        <h2 className="serif italic text-white" style={{ fontSize: 28 }}>What's the room for?</h2>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {TAG_ORDER.map(tag => (
                            <MoodCard
                                key={tag}
                                tag={tag}
                                count={countFor(tag)}
                                active={activeTags.includes(tag)}
                                onClick={() => toggleTag(tag)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── Active tag filter pills ── */}
            {activeTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {activeTags.map(tag => (
                        <div key={tag} className="flex items-center gap-1.5 h-8 px-3 rounded-full ring-1 ring-white/20"
                            style={{ background: TAG_GRADIENTS[tag] ?? 'var(--ink-2)' }}>
                            <span className="serif italic text-white text-[13px]">{tag}</span>
                            <button onClick={() => removeTag(tag)} className="press" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}
                    <button onClick={clearAllTags}
                        className="mono text-[10px] uppercase tracking-wider h-8 px-3 rounded-full ring-1 ring-white/10 hover:bg-white/5 press"
                        style={{ color: 'var(--fg-3)' }}>
                        Clear all
                    </button>
                    <button onClick={() => setShowMoodGrid(m => !m)}
                        className="mono text-[10px] uppercase tracking-wider press" style={{ color: 'var(--fg-3)' }}>
                        {showMoodGrid ? 'Hide moods' : '+ Add mood'}
                    </button>
                </div>
            )}

            {/* Inline mini mood grid — shown when tags active and user wants to add more */}
            {showMoodGrid && activeTags.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {TAG_ORDER.map(tag => (
                        <MoodCard key={tag} tag={tag} count={countFor(tag)} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)} />
                    ))}
                </div>
            )}

            {/* ── Room grid ── */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="size-6 animate-spin" style={{ color: 'var(--fg-3)' }} />
                </div>
            ) : rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                    <Radio className="size-12 opacity-20 text-white" />
                    <p className="text-[14px] text-white">No rooms found</p>
                    <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
                        {debouncedSearch ? 'Try a different search term' : activeTags.length ? `No rooms tagged "${activeTags.join(', ')}" yet` : 'Check back soon for live sessions'}
                    </p>
                    {activeTags.length > 0 && (
                        <button onClick={clearAllTags} className="h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press mt-1">
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Live rooms */}
                    {liveRooms.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="live-dot" style={{ width: 6, height: 6 }} />
                                <p className="mono text-[9px] uppercase tracking-widest text-[oklch(0.82_0.17_20)]">
                                    Live now · {liveRooms.length}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {liveRooms.map(r => <RoomCard key={r._id} room={r} />)}
                            </div>
                        </section>
                    )}

                    {/* Offline rooms */}
                    {offlineRooms.length > 0 && (
                        <section className="space-y-4">
                            <p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Other channels</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {offlineRooms.map(r => <RoomCard key={r._id} room={r} />)}
                            </div>
                        </section>
                    )}

                    {/* Load more */}
                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button onClick={() => fetchRooms(offset + PAGE_SIZE, false)} disabled={loadingMore}
                                className="flex items-center gap-2 h-9 px-5 rounded-xl ring-1 ring-white/10 text-[13px] press hover:bg-white/5 disabled:opacity-50"
                                style={{ color: 'var(--fg-2)' }}>
                                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                                Load more
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default RoomsPage
