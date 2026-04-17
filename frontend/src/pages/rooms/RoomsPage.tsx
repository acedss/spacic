// RoomsPage — public browsable listing of live and offline rooms
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Gem, Radio, Loader2, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { getPublicRooms } from '@/lib/roomService'
import type { RoomInfo } from '@/types/types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const SORT_OPTIONS = [
    { value: 'listeners', label: 'Most listeners' },
    { value: 'newest',    label: 'Newest' },
    { value: 'donations', label: 'Most donated' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['value']

const PAGE_SIZE = 12

// ── Room card ──────────────────────────────────────────────────────────────────

const RoomGridCard = ({ room }: { room: RoomInfo }) => {
    const navigate  = useNavigate()
    const isLive    = room.status === 'live'
    const song      = room.playlist[room.playback?.currentSongIndex ?? 0]

    return (
        <button
            onClick={() => navigate(`/rooms/${room._id}`)}
            className="group text-left bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/20 rounded-2xl overflow-hidden transition-all"
        >
            {/* Cover art */}
            <div className="aspect-video relative overflow-hidden bg-zinc-900">
                {song?.imageUrl ? (
                    <img
                        src={song.imageUrl}
                        alt={song.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Radio className="size-8 text-zinc-700" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Live badge */}
                {isLive && (
                    <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="p-3.5 space-y-2">
                <div>
                    <p className="font-semibold text-sm text-white truncate leading-tight">{room.title}</p>
                    {song && <p className="text-xs text-zinc-500 truncate mt-0.5">{song.title} — {song.artist}</p>}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    {isLive && (
                        <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {(room.listenerCount ?? 0).toLocaleString()}
                        </span>
                    )}
                    {room.streamGoal > 0 && (
                        <span className="flex items-center gap-1">
                            <Gem className="size-3 text-yellow-500/70" />
                            {room.streamGoalCurrent.toLocaleString()}/{room.streamGoal.toLocaleString()}
                        </span>
                    )}
                    {!isLive && (
                        <span className="text-zinc-700">Offline</span>
                    )}
                </div>

                {/* Goal progress bar */}
                {room.streamGoal > 0 && (
                    <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-400/60 rounded-full"
                            style={{ width: `${Math.min(100, (room.streamGoalCurrent / room.streamGoal) * 100)}%` }}
                        />
                    </div>
                )}
            </div>
        </button>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const RoomsPage = () => {
    const [rooms, setRooms]         = useState<RoomInfo[]>([])
    const [loading, setLoading]     = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore]     = useState(false)
    const [offset, setOffset]       = useState(0)
    const [search, setSearch]       = useState('')
    const [sort, setSort]           = useState<SortOption>('listeners')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce search input
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
                limit: PAGE_SIZE,
                offset: newOffset,
            })
            const list: RoomInfo[] = result.data ?? result
            setRooms(prev => replace ? list : [...prev, ...list])
            setHasMore((result.total ?? 0) > newOffset + list.length)
            setOffset(newOffset)
        } catch {
            // silently fail — keep existing list visible
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [sort, debouncedSearch])

    // Re-fetch when sort or search changes
    useEffect(() => {
        fetchRooms(0, true)
    }, [fetchRooms])

    const liveRooms    = rooms.filter(r => r.status === 'live')
    const offlineRooms = rooms.filter(r => r.status !== 'live')

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">Rooms</h1>
                    <p className="text-zinc-500 text-sm mt-1">Join a live co-listening room or browse upcoming sessions</p>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
                    <SlidersHorizontal className="size-3.5 text-zinc-500 ml-2" />
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setSort(opt.value)}
                            className={cn(
                                'text-xs px-3 py-1.5 rounded-lg transition-all',
                                sort === opt.value
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search rooms…"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="size-6 text-zinc-500 animate-spin" />
                </div>
            ) : rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Radio className="size-10 text-zinc-700 mb-3" />
                    <p className="text-zinc-400 font-medium">No rooms found</p>
                    <p className="text-zinc-600 text-sm mt-1">
                        {debouncedSearch ? 'Try a different search term' : 'Check back soon for live sessions'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Live rooms */}
                    {liveRooms.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                                Live now ({liveRooms.length})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {liveRooms.map(r => <RoomGridCard key={r._id} room={r} />)}
                            </div>
                        </section>
                    )}

                    {/* Offline rooms */}
                    {offlineRooms.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                                Other rooms
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {offlineRooms.map(r => <RoomGridCard key={r._id} room={r} />)}
                            </div>
                        </section>
                    )}

                    {/* Load more */}
                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => fetchRooms(offset + PAGE_SIZE, false)}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-zinc-300 transition-colors disabled:opacity-50"
                            >
                                {loadingMore
                                    ? <Loader2 className="size-4 animate-spin" />
                                    : <ChevronRight className="size-4" />
                                }
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
