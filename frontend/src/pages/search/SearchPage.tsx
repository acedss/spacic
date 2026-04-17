// SearchPage — unified search across rooms and songs
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Radio, Music, Users, Gem, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getPublicRooms, getSongs } from '@/lib/roomService'
import type { RoomInfo, Song } from '@/types/types'
import { cn } from '@/lib/utils'

type Tab = 'all' | 'rooms' | 'songs'

// ── Song result card ───────────────────────────────────────────────────────────

const SongCard = ({ song }: { song: Song }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 transition-all group">
        <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{song.title}</p>
            <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
        </div>
        <Music className="size-4 text-zinc-700 flex-shrink-0" />
    </div>
)

// ── Room result card ───────────────────────────────────────────────────────────

const RoomCard = ({ room }: { room: RoomInfo }) => {
    const navigate = useNavigate()
    const isLive   = room.status === 'live'
    const song     = room.playlist[room.playback?.currentSongIndex ?? 0]

    return (
        <button
            onClick={() => navigate(`/rooms/${room._id}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 transition-all group text-left w-full"
        >
            <div className="relative flex-shrink-0">
                {song?.imageUrl
                    ? <img src={song.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                    : <div className="size-10 rounded-lg bg-zinc-800 flex items-center justify-center"><Radio className="size-4 text-zinc-600" /></div>
                }
                {isLive && (
                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 border-2 border-zinc-950" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{room.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {isLive
                        ? <span className="text-[10px] text-red-400 font-semibold">LIVE</span>
                        : <span className="text-[10px] text-zinc-600">Offline</span>
                    }
                    {isLive && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Users className="size-2.5" />{(room.listenerCount ?? 0)}
                        </span>
                    )}
                    {room.streamGoal > 0 && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Gem className="size-2.5 text-yellow-600" />{room.streamGoalCurrent.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SearchPage = () => {
    const [query, setQuery]                   = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [tab, setTab]                       = useState<Tab>('all')
    const [rooms, setRooms]                   = useState<RoomInfo[]>([])
    const [songs, setSongs]                   = useState<Song[]>([])
    const [loading, setLoading]               = useState(false)
    const [allSongs, setAllSongs]             = useState<Song[]>([]) // cached song library

    // Debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(t)
    }, [query])

    // Load song library once (meta only — no audio URLs)
    useEffect(() => {
        getSongs(true).then(setAllSongs).catch(() => {})
    }, [])

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setRooms([]); setSongs([]); return }
        setLoading(true)
        try {
            const lower = q.toLowerCase()

            // Rooms: server-side search
            const roomResult = await getPublicRooms({ search: q, limit: 20 })
            setRooms(roomResult.data ?? [])

            // Songs: client-side filter on cached list
            setSongs(
                allSongs.filter(s =>
                    s.title.toLowerCase().includes(lower) ||
                    s.artist.toLowerCase().includes(lower)
                ).slice(0, 20)
            )
        } catch {
            // keep previous results
        } finally {
            setLoading(false)
        }
    }, [allSongs])

    useEffect(() => {
        doSearch(debouncedQuery)
    }, [debouncedQuery, doSearch])

    const hasQuery     = debouncedQuery.trim().length > 0
    const showRooms    = (tab === 'all' || tab === 'rooms') && rooms.length > 0
    const showSongs    = (tab === 'all' || tab === 'songs') && songs.length > 0
    const noResults    = hasQuery && !loading && rooms.length === 0 && songs.length === 0

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">

            {/* Search input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
                {loading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500 animate-spin" />
                )}
                <Input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search rooms, songs, artists…"
                    className="pl-12 pr-10 h-12 text-base bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 rounded-2xl"
                />
            </div>

            {/* Tab filter — only show when there are results */}
            {hasQuery && (rooms.length > 0 || songs.length > 0) && (
                <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1 w-fit">
                    {(['all', 'rooms', 'songs'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                'text-xs px-3 py-1.5 rounded-lg capitalize transition-all',
                                tab === t ? 'bg-white/10 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            {t === 'all'
                                ? `All (${rooms.length + songs.length})`
                                : t === 'rooms'
                                    ? `Rooms (${rooms.length})`
                                    : `Songs (${songs.length})`
                            }
                        </button>
                    ))}
                </div>
            )}

            {/* No results */}
            {noResults && (
                <div className="text-center py-16">
                    <Search className="size-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400">No results for "{debouncedQuery}"</p>
                    <p className="text-zinc-600 text-sm mt-1">Try a different room name or artist</p>
                </div>
            )}

            {/* Empty state before search */}
            {!hasQuery && (
                <div className="text-center py-16 space-y-3">
                    <Search className="size-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400 font-medium">Search Spacic</p>
                    <p className="text-zinc-600 text-sm">Find live rooms, songs, and artists</p>
                </div>
            )}

            {/* Rooms section */}
            {showRooms && (
                <section className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Radio className="size-3" /> Rooms
                    </p>
                    <div className="space-y-1.5">
                        {rooms.map(r => <RoomCard key={r._id} room={r} />)}
                    </div>
                </section>
            )}

            {/* Songs section */}
            {showSongs && (
                <section className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Music className="size-3" /> Songs
                    </p>
                    <div className="space-y-1.5">
                        {songs.map(s => <SongCard key={s._id} song={s} />)}
                    </div>
                </section>
            )}
        </div>
    )
}

export default SearchPage
