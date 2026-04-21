import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Radio, Music, Users, Gem, Loader2, X, ArrowRight } from 'lucide-react'
import { getPublicRooms, getSongs } from '@/lib/roomService'
import type { RoomInfo, Song } from '@/types/types'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onClose: () => void
}

export const SearchPalette = ({ open, onClose }: Props) => {
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)
    const [query, setQuery]       = useState('')
    const [rooms, setRooms]       = useState<RoomInfo[]>([])
    const [songs, setSongs]       = useState<Song[]>([])
    const [allSongs, setAllSongs] = useState<Song[]>([])
    const [loading, setLoading]   = useState(false)
    const [selected, setSelected] = useState(0)

    // Load song library once
    useEffect(() => {
        getSongs(true).then(setAllSongs).catch(() => {})
    }, [])

    // Focus input when palette opens
    useEffect(() => {
        if (open) {
            setQuery('')
            setRooms([])
            setSongs([])
            setSelected(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [open])

    // Debounced search
    useEffect(() => {
        if (!open) return
        const t = setTimeout(async () => {
            if (!query.trim()) { setRooms([]); setSongs([]); return }
            setLoading(true)
            try {
                const lower = query.toLowerCase()
                const [roomResult] = await Promise.all([
                    getPublicRooms({ search: query, limit: 8 }),
                ])
                setRooms(roomResult.data ?? [])
                setSongs(
                    allSongs.filter(s =>
                        s.title.toLowerCase().includes(lower) ||
                        s.artist.toLowerCase().includes(lower)
                    ).slice(0, 6)
                )
            } finally {
                setLoading(false)
            }
        }, 250)
        return () => clearTimeout(t)
    }, [query, open, allSongs])

    const allResults = [
        ...rooms.map(r => ({ type: 'room' as const, id: r._id, label: r.title, sub: r.status === 'live' ? `LIVE · ${r.listenerCount ?? 0} listening` : 'Offline', img: (r.playlist[r.playback?.currentSongIndex ?? 0] as any)?.imageUrl, isLive: r.status === 'live', roomId: r._id })),
        ...songs.map(s => ({ type: 'song' as const, id: s._id, label: s.title, sub: s.artist, img: s.imageUrl, isLive: false, roomId: '' })),
    ]

    const handleSelect = useCallback((item: typeof allResults[0]) => {
        if (item.type === 'room') navigate(`/rooms/${item.roomId}`)
        onClose()
    }, [navigate, onClose])

    // Keyboard navigation
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allResults.length - 1)) }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
            if (e.key === 'Enter' && allResults[selected]) handleSelect(allResults[selected])
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, allResults, selected, onClose, handleSelect])

    if (!open) return null

    const hasResults = allResults.length > 0
    const hasQuery   = query.trim().length > 0

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center pt-[15vh] px-4"
            style={{ background: 'oklch(0.06 0.01 285 / 0.85)', backdropFilter: 'blur(12px)' }}
            onClick={onClose}
        >
            {/* Palette panel */}
            <div
                className="w-full max-w-xl rounded-2xl ring-1 ring-white/10 overflow-hidden shadow-2xl"
                style={{ background: 'oklch(0.14 0.025 285)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search input row */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b hair">
                    {loading
                        ? <Loader2 className="size-4 animate-spin shrink-0" style={{ color: 'var(--fg-3)' }} />
                        : <Search className="size-4 shrink-0" style={{ color: 'var(--fg-3)' }} />
                    }
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelected(0) }}
                        placeholder="Search rooms, creators, songs…"
                        className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[var(--fg-3)] outline-none"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="shrink-0 p-1 rounded hover:bg-white/8">
                            <X className="size-3.5" style={{ color: 'var(--fg-3)' }} />
                        </button>
                    )}
                    <kbd className="mono text-[9px] px-1.5 py-1 rounded-md ring-1 ring-white/12 shrink-0" style={{ color: 'var(--fg-3)', background: 'oklch(1 0 0 / 0.04)' }}>
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                {hasResults && (
                    <div className="max-h-[360px] overflow-y-auto hide-scrollbar py-2">
                        {/* Room results */}
                        {rooms.length > 0 && (
                            <div>
                                <p className="px-4 pt-2 pb-1 mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                                    <Radio className="size-2.5 inline mr-1.5 -mt-0.5" />Rooms
                                </p>
                                {rooms.map((r, i) => {
                                    const isSelected = selected === i
                                    const song = r.playlist[r.playback?.currentSongIndex ?? 0]
                                    return (
                                        <button key={r._id} onClick={() => handleSelect(allResults[i])}
                                            className={cn('flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                                                isSelected ? 'bg-white/8' : 'hover:bg-white/5'
                                            )}>
                                            <div className="relative shrink-0">
                                                {song?.imageUrl
                                                    ? <img src={song.imageUrl} className="w-9 h-9 rounded-lg object-cover" alt="" />
                                                    : <div className="w-9 h-9 rounded-lg bg-white/8 grid place-items-center"><Radio className="size-4" style={{ color: 'var(--fg-3)' }} /></div>
                                                }
                                                {r.status === 'live' && (
                                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.22_20)] border-2 border-[oklch(0.14_0.025_285)]" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] text-white truncate">{r.title}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {r.status === 'live'
                                                        ? <span className="mono text-[10px] text-[oklch(0.72_0.22_20)]">LIVE</span>
                                                        : <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Offline</span>
                                                    }
                                                    {r.status === 'live' && (
                                                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--fg-3)' }}>
                                                            <Users className="size-2.5" />{r.listenerCount ?? 0}
                                                        </span>
                                                    )}
                                                    {r.streamGoal > 0 && (
                                                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--fg-3)' }}>
                                                            <Gem className="size-2.5 text-[oklch(0.88_0.12_75)]" />{r.streamGoalCurrent.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ArrowRight className={cn('size-3.5 shrink-0 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')} style={{ color: 'var(--fg-3)' }} />
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Song results */}
                        {songs.length > 0 && (
                            <div>
                                <p className="px-4 pt-3 pb-1 mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                                    <Music className="size-2.5 inline mr-1.5 -mt-0.5" />Songs
                                </p>
                                {songs.map((s, si) => {
                                    const idx = rooms.length + si
                                    const isSelected = selected === idx
                                    return (
                                        <div key={s._id}
                                            className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors',
                                                isSelected ? 'bg-white/8' : 'hover:bg-white/5'
                                            )}>
                                            {s.imageUrl
                                                ? <img src={s.imageUrl} className="w-9 h-9 rounded-lg object-cover shrink-0" alt="" />
                                                : <div className="w-9 h-9 rounded-lg bg-white/8 grid place-items-center shrink-0"><Music className="size-4" style={{ color: 'var(--fg-3)' }} /></div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] text-white truncate">{s.title}</p>
                                                <p className="text-[11px] truncate" style={{ color: 'var(--fg-3)' }}>{s.artist}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* No results */}
                {hasQuery && !loading && !hasResults && (
                    <div className="py-12 text-center">
                        <Search className="size-7 mx-auto mb-3 opacity-20 text-white" />
                        <p className="text-[13px] text-white">No results for "{query}"</p>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--fg-3)' }}>Try a room name, song, or artist</p>
                    </div>
                )}

                {/* Empty hint */}
                {!hasQuery && (
                    <div className="px-4 py-4 flex items-center gap-4 flex-wrap">
                        {[
                            { label: 'Live rooms', icon: Radio },
                            { label: 'Songs', icon: Music },
                            { label: 'Artists', icon: Users },
                        ].map(({ label, icon: Icon }) => (
                            <span key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--fg-3)' }}>
                                <Icon className="size-3" />{label}
                            </span>
                        ))}
                    </div>
                )}

                {/* Footer hint */}
                <div className="px-4 py-2.5 border-t hair flex items-center gap-4">
                    {[['↑↓', 'Navigate'], ['↵', 'Go'], ['Esc', 'Close']].map(([key, action]) => (
                        <span key={key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--fg-3)' }}>
                            <kbd className="mono px-1.5 py-0.5 rounded ring-1 ring-white/10 text-[9px]" style={{ background: 'oklch(1 0 0 / 0.05)' }}>{key}</kbd>
                            {action}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
