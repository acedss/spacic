import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { getPublicRooms, getTagCounts } from '@/lib/roomService'
import type { RoomInfo } from '@/types/types'

import { PAGE_SIZE, type SortOption } from './components/constants'
import { RoomCard } from './components/RoomCard'
import { RoomsHeader } from './components/RoomsHeader'
import { MoodGrid } from './components/MoodGrid'
import { ActiveTagsBar } from './components/ActiveTagsBar'
import { RoomsEmptyState } from './components/RoomsEmptyState'

const RoomsPage = () => {
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

    useEffect(() => { getTagCounts().then(setTagCounts).catch(() => {}) }, [])

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
            <RoomsHeader search={search} setSearch={setSearch} sort={sort} setSort={setSort} />

            {showMoodGrid && !debouncedSearch && activeTags.length === 0 && (
                <MoodGrid activeTags={activeTags} onToggle={toggleTag} countFor={countFor} titled />
            )}

            {activeTags.length > 0 && (
                <ActiveTagsBar
                    activeTags={activeTags}
                    onRemove={toggleTag}
                    onClear={clearAllTags}
                    showMoodGrid={showMoodGrid}
                    onToggleGrid={() => setShowMoodGrid(m => !m)}
                />
            )}

            {showMoodGrid && activeTags.length > 0 && (
                <MoodGrid activeTags={activeTags} onToggle={toggleTag} countFor={countFor} compact />
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="size-6 animate-spin" style={{ color: 'var(--fg-3)' }} />
                </div>
            ) : rooms.length === 0 ? (
                <RoomsEmptyState debouncedSearch={debouncedSearch} activeTags={activeTags} onClear={clearAllTags} />
            ) : (
                <>
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

                    {offlineRooms.length > 0 && (
                        <section className="space-y-4">
                            <p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Other channels</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {offlineRooms.map(r => <RoomCard key={r._id} room={r} />)}
                            </div>
                        </section>
                    )}

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
