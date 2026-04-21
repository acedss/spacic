import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCheck, UserMinus, Users, Radio, Clock, Mic2 } from 'lucide-react'
import { getFavoriteRooms, toggleFavorite } from '@/lib/roomService'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { RoomInfo } from '@/types/types'
import { cn } from '@/lib/utils'

// ── Creator follow card — matches the screenshot UI ───────────────────────────

const CreatorCard = ({ room, onUnfollow }: { room: RoomInfo; onUnfollow: () => void }) => {
    const navigate = useNavigate()
    const creator  = (room as any).creatorId as { fullName?: string; imageUrl?: string } | null
    const isLive   = room.status === 'live'
    const coverImg = (room.playlist as any[])?.[0]?.imageUrl ?? ''
    const s = room.stats

    const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)
    const hrs  = Math.round((s?.totalMinutesListened ?? 0) / 60)

    return (
        <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden glass">
            {/* Cover header */}
            <div className="relative h-36 overflow-hidden">
                {coverImg
                    ? <img src={coverImg} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full" style={{ background: 'oklch(0.2 0.06 295)' }} />
                }
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0.7) 100%)' }} />

                {/* Live badge */}
                {isLive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[oklch(0.72_0.22_20_/_0.9)] text-white">
                        <span className="live-dot" style={{ width: 5, height: 5 }} />
                        Live Now · {(room.listenerCount ?? 0).toLocaleString()} listening
                    </div>
                )}

                {/* Station label */}
                <div className="absolute bottom-3 left-4 right-4">
                    <p className="mono text-[9px] uppercase tracking-widest text-white/50 mb-0.5">Creator Station</p>
                    <h3 className="serif italic text-white text-[22px] leading-tight truncate">{room.title}</h3>
                </div>
            </div>

            {/* Creator info row */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b hair">
                {creator?.imageUrl
                    ? <img src={creator.imageUrl} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/15 shrink-0" alt="" />
                    : <div className="w-10 h-10 rounded-full shrink-0 bg-white/10 grid place-items-center"><Mic2 className="size-4 text-white/40" /></div>
                }
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-white font-medium truncate">{creator?.fullName ?? 'Creator'}</p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
                        Creator · {room.favoriteCount.toLocaleString()} followers
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(`/rooms/${room._id}`)}
                        className={cn(
                            'h-8 px-4 rounded-xl text-[12px] font-semibold press transition-all',
                            isLive
                                ? 'bg-[oklch(0.72_0.22_20)] text-white'
                                : 'bg-white text-[var(--ink-0)]'
                        )}>
                        {isLive ? 'Join Live' : 'Visit'}
                    </button>
                    <button
                        onClick={onUnfollow}
                        title="Unfollow"
                        className="h-8 w-8 rounded-xl grid place-items-center ring-1 ring-white/12 hover:bg-[oklch(0.72_0.22_20_/_0.12)] hover:ring-[oklch(0.72_0.22_20_/_0.4)] press transition-all"
                        style={{ color: 'var(--fg-3)' }}>
                        <UserMinus className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Stats row */}
            {s && (
                <div className="grid grid-cols-3 divide-x divide-white/6 px-4 py-3">
                    {[
                        { icon: Radio, label: 'Rooms Hosted',       value: fmt(s.totalSessions ?? 0) },
                        { icon: Users, label: 'Listeners Reached',  value: fmt(s.totalListeners ?? 0) },
                        { icon: Clock, label: 'Hrs Streamed',        value: fmt(hrs) },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center gap-0.5 px-2">
                            <p className="mono text-[18px] text-white tabular-nums font-semibold leading-none">{value}</p>
                            <p className="mono text-[8px] uppercase tracking-widest text-center" style={{ color: 'var(--fg-3)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Upcoming / description */}
            {room.description && (
                <div className="px-4 pb-4">
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{room.description}</p>
                </div>
            )}
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const FavoritesPage = () => {
    const navigate = useNavigate()
    const [rooms, setRooms]   = useState<RoomInfo[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getFavoriteRooms()
            .then(res => setRooms(res.data ?? []))
            .catch(() => setRooms([]))
            .finally(() => setLoading(false))
    }, [])

    const handleUnfollow = async (roomId: string) => {
        try {
            await toggleFavorite(roomId)
            setRooms(prev => prev.filter(r => r._id !== roomId))
            toast.success('Unfollowed')
        } catch {
            toast.error('Could not unfollow')
        }
    }

    if (loading) {
        return (
            <div className="p-8 space-y-6 max-w-4xl mx-auto">
                <div className="h-8 w-40 rounded-xl bg-white/5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl bg-white/5" />)}
                </div>
            </div>
        )
    }

    const live    = rooms.filter(r => r.status === 'live')
    const offline = rooms.filter(r => r.status !== 'live')

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Your library</div>
                    <h1 className="serif italic text-white" style={{ fontSize: 36 }}>Following</h1>
                </div>
                <span className="mono text-[11px] px-3 py-1 rounded-full ring-1 ring-white/10 bg-white/4" style={{ color: 'var(--fg-2)' }}>
                    {rooms.length} {rooms.length === 1 ? 'creator' : 'creators'}
                </span>
            </div>

            {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <UserCheck className="size-12 opacity-20 text-white" />
                    <p className="text-[14px] text-white">Not following anyone yet</p>
                    <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>Favorite a room to follow its creator</p>
                    <button onClick={() => navigate('/')}
                        className="h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                        Browse rooms
                    </button>
                </div>
            ) : (
                <>
                    {/* Live now */}
                    {live.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="live-dot" style={{ width: 6, height: 6 }} />
                                <p className="mono text-[9px] uppercase tracking-widest text-[oklch(0.82_0.17_20)]">Live now</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {live.map(r => (
                                    <CreatorCard key={r._id} room={r} onUnfollow={() => handleUnfollow(r._id)} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Offline */}
                    {offline.length > 0 && (
                        <section className="space-y-4">
                            <p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Offline creators</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {offline.map(r => (
                                    <CreatorCard key={r._id} room={r} onUnfollow={() => handleUnfollow(r._id)} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}

export default FavoritesPage
