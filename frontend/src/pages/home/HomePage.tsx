import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { Search, Zap, Play, Radio, Heart, ChevronRight, Users, Gem, ArrowRight, Bell, Sparkles } from 'lucide-react'
import { useWalletStore } from '@/stores/useWalletStore'
import { getPublicRooms, toggleFavorite, getFavoriteStatus } from '@/lib/roomService'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { useAuth } from '@clerk/clerk-react'
import { axiosInstance } from '@/lib/axios'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

const FALLBACK = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'
const COVER_FALLBACKS = [
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=70',
    'https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?w=400&q=70',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=70',
    'https://images.unsplash.com/photo-1429552077091-836152271555?w=400&q=70',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=70',
]

const MOODS = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi']

const STATIC_GOALS = [
    { title: 'Debut LP — mixing & mastering', artist: 'Remy Okafor', cover: COVER_FALLBACKS[0], raised: 3020, goal: 4200, days: 12 },
    { title: 'Tour van fuel fund', artist: 'Iris Holm', cover: COVER_FALLBACKS[1], raised: 740, goal: 1800, days: 22 },
    { title: 'Studio time · 3 days at Electric Pine', artist: 'Noa Tanaka', cover: COVER_FALLBACKS[2], raised: 855, goal: 900, days: 3 },
]

interface RoomData {
    _id: string
    title: string
    description: string
    listenerCount: number
    streamGoal: number
    streamGoalCurrent: number
    playlist: { _id: string; title: string; artist: string; imageUrl: string }[]
    creatorId: { fullName: string; imageUrl: string }
}

const goalPct = (r: RoomData) =>
    r.streamGoal > 0 ? Math.min(100, Math.round((r.streamGoalCurrent / r.streamGoal) * 100)) : 0

const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 5) return 'Still up'
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    if (h < 22) return 'Good evening'
    return 'Late night'
}

/* ─── Small primitives ─────────────────────────────────────────────────── */
const LiveDot = () => <span className="live-dot" style={{ width: 6, height: 6 }} />

const MiniWave = ({ count = 28 }: { count?: number }) => {
    const bars = Array.from({ length: count }, (_, i) => {
        const v = 0.25 + Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.27)) * 0.9
        return Math.max(0.18, Math.min(1, v))
    })
    return (
        <div className="flex items-end gap-[2px] h-[18px]">
            {bars.map((h, i) => (
                <span key={i} style={{
                    height: `${h * 100}%`, width: 2,
                    background: 'white', opacity: 0.6, borderRadius: 2,
                    animation: `wf ${1 + (i % 5) * 0.15}s ease-in-out ${i * 0.03}s infinite alternate`,
                }} />
            ))}
        </div>
    )
}

const Equalizer = () => (
    <span className="inline-flex items-end gap-[2px] text-[oklch(0.82_0.17_20)]">
        {[8, 13, 9, 12].map((h, i) => (
            <span key={i} style={{ width: 2, height: h, background: 'currentColor', borderRadius: 1, opacity: 0.8, animation: `wf ${0.9 + i * 0.2}s ease-in-out ${i * 0.2}s infinite alternate` }} />
        ))}
    </span>
)

/* ─── RoomCard ─────────────────────────────────────────────────────────── */
const RoomCard = ({ room, onJoin }: { room: RoomData; onJoin: (id: string) => void }) => {
    const pct = goalPct(room)
    const image = room.coverImageUrl || room.playlist[0]?.imageUrl || FALLBACK
    const artist = room.playlist[0]?.artist ?? room.creatorId?.fullName ?? '—'

    return (
        <div
            className="group press relative rounded-2xl overflow-hidden ring-1 ring-white/8 hover:ring-white/20 transition-all cursor-pointer"
            style={{ background: 'var(--ink-2)' }}
            onClick={() => onJoin(room._id)}
        >
            <div className="relative aspect-[4/3] overflow-hidden">
                <img src={image} alt={room.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, oklch(0.1 0.02 285 / 0.85) 100%)' }} />
                <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                        <LiveDot /> {room.listenerCount.toLocaleString()}
                    </span>
                </div>
                <button
                    className="absolute top-3 right-3 h-8 w-8 rounded-full grid place-items-center bg-black/40 backdrop-blur ring-1 ring-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => { e.stopPropagation(); onJoin(room._id) }}
                >
                    <Play className="size-3 ml-0.5" />
                </button>
                <div className="absolute left-4 right-4 bottom-3">
                    <div className="flex items-center gap-2 mb-1">
                        {room.creatorId?.imageUrl && (
                            <img src={room.creatorId.imageUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
                        )}
                        <span className="text-[11px] text-white/80">{room.creatorId?.fullName ?? artist}</span>
                    </div>
                    <h3 className="serif text-[22px] leading-[1.1] text-white truncate">{room.title}</h3>
                </div>
            </div>
            <div className="px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] truncate" style={{ color: 'var(--fg-2)' }}>
                        {room.playlist[0]?.title ? `${room.playlist[0].title} — ${artist}` : artist}
                    </span>
                    <Equalizer />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.78 0.22 330))' }} />
                    </div>
                    <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{pct}%</span>
                </div>
            </div>
        </div>
    )
}

/* ─── TasteCard (square) ───────────────────────────────────────────────── */
const TasteCard = ({ room, onJoin }: { room: RoomData; onJoin: (id: string) => void }) => {
    const image = room.coverImageUrl || room.playlist[0]?.imageUrl || FALLBACK
    const GENRE_COLORS = ['oklch(0.72 0.22 20)', 'oklch(0.68 0.21 295)', 'oklch(0.74 0.14 160)', 'oklch(0.88 0.12 75)']
    const color = GENRE_COLORS[room.listenerCount % GENRE_COLORS.length]

    return (
        <div
            className="press rounded-xl overflow-hidden ring-1 ring-white/8 hover:ring-white/20 cursor-pointer transition-all"
            style={{ background: 'var(--ink-2)' }}
            onClick={() => onJoin(room._id)}
        >
            <div className="relative aspect-square overflow-hidden">
                <img src={image} className="w-full h-full object-cover" alt={room.title} />
                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                    <LiveDot />
                </span>
                <button className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full grid place-items-center bg-white text-[var(--ink-0)] press shadow-lg">
                    <Play className="size-3 ml-0.5" />
                </button>
            </div>
            <div className="p-3">
                <p className="text-[13px] text-white truncate">{room.title}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--fg-3)' }}>
                    {room.listenerCount.toLocaleString()} listening · {room.creatorId?.fullName?.split(' ')[0] ?? '—'}
                </p>
                <div className="mt-2">
                    <span className="mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
                        {room.playlist[0]?.artist ?? 'Live'}
                    </span>
                </div>
            </div>
        </div>
    )
}

/* ─── AlbumGoalCard ─────────────────────────────────────────────────────── */
const AlbumGoalCard = ({ title, artist, cover, raised, goal, days }: {
    title: string; artist: string; cover: string; raised: number; goal: number; days: number
}) => {
    const pct = Math.min(100, Math.round((raised / goal) * 100))
    const covers = [cover, COVER_FALLBACKS[(COVER_FALLBACKS.indexOf(cover) + 1) % COVER_FALLBACKS.length], COVER_FALLBACKS[(COVER_FALLBACKS.indexOf(cover) + 2) % COVER_FALLBACKS.length]]
    return (
        <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 press hover:ring-white/20 transition-all" style={{ background: 'var(--ink-1)' }}>
            <div className="relative h-28 flex"
                style={{ background: 'linear-gradient(135deg, oklch(0.22 0.04 295), oklch(0.2 0.04 60))' }}>
                <div className="flex-1 flex items-center gap-2 px-4">
                    {covers.map((c, j) => (
                        <img key={j} src={c} className="w-12 h-12 rounded-md object-cover ring-1 ring-white/20"
                            style={{ transform: `rotate(${(j - 1) * 4}deg) translateY(${j === 1 ? -4 : 0}px)` }} alt="" />
                    ))}
                </div>
                <div className="p-3 self-end">
                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.82_0.15_75_/_0.14)] text-[oklch(0.88_0.12_75)] ring-1 ring-[oklch(0.82_0.15_75_/_0.35)]">
                        <Gem className="size-2.5" /> ${raised.toLocaleString()} / ${goal.toLocaleString()}
                    </span>
                </div>
            </div>
            <div className="p-5">
                <p className="text-[12px] mb-1" style={{ color: 'var(--fg-2)' }}>{artist}</p>
                <h4 className="serif text-[22px] leading-tight text-white">{title}</h4>
                <div className="mt-4 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                    </div>
                    <span className="mono text-[11px] text-white tabular-nums">{pct}%</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>{days} days left</span>
                    <button className="h-7 px-3 rounded-lg bg-[oklch(0.88_0.12_75)] text-[oklch(0.18_0.02_80)] text-[11px] font-semibold press">
                        Contribute
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Main HomePage ─────────────────────────────────────────────────────── */
const HomePage = () => {
    const { user } = useUser()
    const { userId } = useAuth()
    const { fetchWallet, balance } = useWalletStore()
    const navigate = useNavigate()
    const socket = useSocialSocket()

    const [rooms, setRooms] = useState<RoomData[]>([])
    const [loading, setLoading] = useState(true)
    const [featuredFav, setFeaturedFav] = useState(false)
    const [filter, setFilter] = useState<'All' | 'For you' | 'Friends' | 'Nearby'>('All')
    const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)

    const openSearch = useCallback(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    }, [])

    const refreshRooms = async () => {
        try {
            const res = await getPublicRooms({ limit: 12, sort: 'listener_count' })
            setRooms(res.data ?? [])
        } catch { /* handled */ }
    }

    useEffect(() => { fetchWallet() }, [fetchWallet])

    useEffect(() => {
        refreshRooms().finally(() => setLoading(false))
    }, [])

    // Check onboarding status for logged-in users
    useEffect(() => {
        if (!userId) return
        axiosInstance.get('/auth/onboarding/status')
            .then(({ data }) => { if (!data.onboardingCompleted) setShowOnboardingBanner(true) })
            .catch(() => { })
    }, [userId])

    useEffect(() => {
        if (!socket) return
        const onStatus = () => refreshRooms()
        socket.on('creator:room_live', onStatus)
        socket.on('creator:room_offline', onStatus)
        return () => { socket.off('creator:room_live', onStatus); socket.off('creator:room_offline', onStatus) }
    }, [socket])

    useEffect(() => {
        if (!userId || rooms.length === 0) return
        getFavoriteStatus(rooms[0]._id).then(setFeaturedFav).catch(() => { })
    }, [userId, rooms])

    const handleJoin = (id: string) => navigate(`/rooms/${id}`)

    const handleFeaturedFav = async () => {
        if (!userId) { navigate('/sign-in'); return }
        try {
            const { favorited } = await toggleFavorite(rooms[0]._id)
            setFeaturedFav(favorited)
            toast.success(favorited ? 'Added to favorites' : 'Removed from favorites')
        } catch { toast.error('Could not update favorites') }
    }

    const featured = rooms[0]
    const liveNow = rooms.slice(1)
    const tasteRooms = rooms.slice(2, 7)
    const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

    return (
        <div className="relative" style={{ background: 'var(--ink-0)', minHeight: '100vh' }}>

            {/* ── Onboarding banner ─────────────────────────────────────────── */}
            {showOnboardingBanner && (
                <div className="relative z-20 flex items-center gap-4 px-10 py-3 border-b hair"
                    style={{ background: 'linear-gradient(90deg, oklch(0.68 0.21 295 / 0.1), oklch(0.88 0.12 75 / 0.1))' }}>
                    <Sparkles className="size-4 text-[oklch(0.88_0.12_75)]" />
                    <span className="text-[13px] text-white flex-1">Complete your setup to get personalized recommendations and 100 bonus coins.</span>
                    <button onClick={() => navigate('/onboarding')}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">
                        <Zap className="size-3.5" /> Finish setup
                    </button>
                    <button onClick={() => setShowOnboardingBanner(false)}
                        className="text-[var(--fg-3)] hover:text-white text-[12px]">✕</button>
                </div>
            )}

            {/* ── Top search bar ──────────────────────────────────────────── */}
            <div className="sticky top-0 z-20 flex items-center gap-4 px-10 h-16 border-b hair glass">
                <button onClick={openSearch} className="flex items-center gap-2  flex-1 text-left">
                    <Search className="size-3.5 shrink-0" style={{ color: 'var(--fg-3)' }} />
                    <span className="text-[13px] w-105 truncate text-zinc-300" >Search rooms, creators, songs…</span>
                    <kbd className="mono text-[10px] px-2 py-0.5 rounded-md ring-1 ring-white/10 ml-auto" style={{ color: 'var(--fg-3)', background: 'var(--ink-2)' }}>⌘K</kbd>
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/studio')}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-white hover:bg-white/8 transition-colors"
                    >
                        <Zap className="size-3" /> Go live
                    </button>
                    <button className="h-9 w-9 rounded-full grid place-items-center text-[oklch(0.88_0.12_75)] hover:bg-white/8 transition-colors">
                        <Gem className="size-4" />
                    </button>
                    <span className="mono text-[11px] text-white">{balance > 0 ? balance.toLocaleString() : '0'}</span>
                    <div className="h-5 w-px bg-white/10 mx-1" />
                    {user && (
                        <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full ring-1 ring-white/15 object-cover" />
                    )}
                </div>
            </div>

            {/* ── 1. Hero ─────────────────────────────────────────────────── */}
            <section className="relative px-10 pt-14 pb-20 overflow-hidden">
                <div className="aurora aurora-breathe" />
                <div className="grain" />

                <div className="relative grid grid-cols-12 gap-10">
                    {/* Left editorial copy */}
                    <div className="col-span-7 flex flex-col justify-between" style={{ minHeight: 520 }}>
                        <div>
                            <div className="flex items-center gap-3 mb-10">
                                <span className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>
                                    Tonight · {todayStr}
                                </span>
                                <span className="w-8 h-px bg-white/15" />
                                <span className="mono text-[10px] uppercase tracking-[0.25em] text-[oklch(0.82_0.17_20)]">
                                    Live across {rooms.length > 0 ? `${rooms.length * 34}+` : '412'} rooms
                                </span>
                            </div>

                            <h1 className="serif text-white leading-[0.95] tracking-[-0.02em]"
                                style={{ fontSize: 'clamp(60px, 7.2vw, 108px)' }}>
                                {getGreeting()},<br />
                                <span className="italic opacity-85">the night</span> is<br />
                                <span className="italic" style={{
                                    background: 'linear-gradient(100deg, oklch(0.88 0.12 75) 10%, oklch(0.78 0.22 330) 55%, oklch(0.7 0.2 295) 90%)',
                                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                                }}>playing.</span>
                            </h1>

                            <p className="mt-8 text-[18px] leading-relaxed max-w-[520px]" style={{ color: 'var(--fg-1)' }}>
                                Drop into a live room where real people are listening to the same song, at the same second — from Berlin to Lagos to your couch.
                            </p>

                            <div className="flex items-center gap-3 mt-8">
                                <button
                                    onClick={() => navigate('/rooms')}
                                    className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press"
                                >
                                    <Play className="size-3.5" /> Tune in · Live tonight
                                </button>
                                <button
                                    onClick={() => navigate('/studio')}
                                    className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/15 text-white text-[14px] hover:bg-white/4 press"
                                >
                                    <Radio className="size-3.5" /> Host a room
                                </button>
                            </div>
                        </div>

                        {featured && (
                            <div className="mt-10 pt-6 border-t hair flex items-center gap-6">
                                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Now playing</span>
                                <MiniWave count={28} />
                                <span className="text-[13px] text-white truncate">
                                    {featured.playlist[0]?.title ?? featured.title}
                                    {' '}
                                    <span style={{ color: 'var(--fg-3)' }}>— {featured.playlist[0]?.artist ?? featured.creatorId?.fullName}</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: featured room hero card */}
                    <div className="col-span-5">
                        {loading ? (
                            <Skeleton className="w-full aspect-[4/5] rounded-2xl bg-white/5" />
                        ) : featured ? (
                            <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10" style={{ aspectRatio: '4/5' }}>
                                <img src={featured.playlist[0]?.imageUrl ?? FALLBACK} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, oklch(0.08 0.015 285 / 0.85) 100%)' }} />

                                {/* Chips */}
                                <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                                            <LiveDot /> {featured.listenerCount.toLocaleString()} listening
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-black/70 text-white/90 ring-1 ring-white/15">
                                            Featured · Pre-release
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleFeaturedFav}
                                        className="h-9 w-9 rounded-full grid place-items-center bg-white/10 backdrop-blur ring-1 ring-white/20 press"
                                    >
                                        <Heart className={`size-3.5 ${featuredFav ? 'fill-red-400 text-red-400' : 'text-white'}`} />
                                    </button>
                                </div>

                                {/* Bottom caption */}
                                <div className="absolute left-0 right-0 bottom-0 p-6">
                                    {featured.creatorId && (
                                        <div className="flex items-center gap-2 mb-2">
                                            {featured.creatorId.imageUrl && (
                                                <img src={featured.creatorId.imageUrl} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20" alt="" />
                                            )}
                                            <span className="text-[12px] text-white/90">{featured.creatorId.fullName}</span>
                                            <span className="text-[11px] text-white/50">hosting</span>
                                        </div>
                                    )}
                                    <h3 className="serif text-[36px] leading-[1.05] text-white">{featured.title}</h3>
                                    {featured.description && (
                                        <p className="text-[13px] text-white/70 mt-1 line-clamp-2 max-w-[320px]">{featured.description}</p>
                                    )}
                                    <div className="mt-4">
                                        <button
                                            onClick={() => handleJoin(featured._id)}
                                            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press"
                                        >
                                            <Play className="size-3" /> Join
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative rounded-2xl ring-1 ring-white/8 flex items-center justify-center text-center p-12"
                                style={{ aspectRatio: '4/5', background: 'var(--ink-2)' }}>
                                <div>
                                    <Radio className="size-10 mx-auto mb-4 opacity-30 text-white" />
                                    <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>No live rooms right now</p>
                                    <button onClick={() => navigate('/studio')} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">
                                        <Zap className="size-3" /> Start one
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── 2. Live Now Strip ────────────────────────────────────────── */}
            <section className="relative border-y hair" style={{ background: 'var(--ink-1)' }}>
                <div className="px-10 py-10">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Radio className="size-4 text-[oklch(0.82_0.17_20)]" />
                                <span className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>Live now · updated every 30s</span>
                            </div>
                            <h2 className="serif text-white" style={{ fontSize: 44 }}>Tune the dial.</h2>
                        </div>
                        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--fg-2)' }}>
                            {(['All', 'For you', 'Friends', 'Nearby'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`chip rounded-full px-3 py-1.5 ring-1 ring-white/12 ${filter === f ? 'chip-on' : ''}`}
                                >
                                    {f}
                                </button>
                            ))}
                            <span className="w-px h-5 bg-white/10 mx-1" />
                            <button className="chip rounded-full px-3 py-1.5 ring-1 ring-white/12">Ambient</button>
                            <button className="chip rounded-full px-3 py-1.5 ring-1 ring-white/12">R&amp;B</button>
                            <button className="chip rounded-full px-3 py-1.5 ring-1 ring-white/12">Indie</button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-4 gap-5">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-[4/3] rounded-2xl bg-white/5" />
                            ))}
                        </div>
                    ) : liveNow.length > 0 ? (
                        <>
                            <div className="grid grid-cols-4 gap-5">
                                {liveNow.slice(0, 4).map(r => <RoomCard key={r._id} room={r} onJoin={handleJoin} />)}
                            </div>
                            {liveNow.length > 4 && (
                                <div className="mt-5 grid grid-cols-4 gap-5">
                                    {liveNow.slice(4, 8).map(r => <RoomCard key={r._id} room={r} onJoin={handleJoin} />)}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-40 flex items-center justify-center rounded-2xl ring-1 ring-white/8" style={{ background: 'var(--ink-2)' }}>
                            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>No other rooms active</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ── 3. TasteRow ──────────────────────────────────────────────── */}
            <section className="px-10 py-16 relative">
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>
                            Because you replayed <span className="text-white/80">"Harbor"</span> three nights in a row
                        </div>
                        <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>Quieter corners of the dial.</h2>
                    </div>
                    <button
                        onClick={() => navigate('/rooms')}
                        className="inline-flex items-center gap-1 text-[12px] hover:text-white transition-colors"
                        style={{ color: 'var(--fg-2)' }}
                    >
                        View all <ChevronRight className="size-3" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl bg-white/5" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-5 gap-4">
                        {(tasteRooms.length > 0 ? tasteRooms : rooms.slice(0, 5)).map(r => (
                            <TasteCard key={r._id} room={r} onJoin={handleJoin} />
                        ))}
                    </div>
                )}
            </section>

            {/* ── 4. Friends Activity ──────────────────────────────────────── */}
            <section className="px-10 py-16 relative border-t hair" style={{ background: 'linear-gradient(180deg, transparent, oklch(0.12 0.015 285) 30%)' }}>
                <div className="grid grid-cols-12 gap-10">
                    <div className="col-span-5">
                        <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>Your circle</div>
                        <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>Friends are listening.</h2>
                        <p className="text-[15px] mt-4 max-w-[420px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>
                            When someone you follow joins a room, it shows up here — so the night never feels empty.
                        </p>
                        <div className="mt-6 flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[var(--ink-0)]" style={{ background: `oklch(0.5 0.15 ${(i * 60) % 360})` }} />
                                ))}
                            </div>
                            <span className="text-[12px]" style={{ color: 'var(--fg-2)' }}>8 friends online · <span className="text-white">5 in rooms</span></span>
                        </div>
                        <button
                            onClick={() => navigate('/friends')}
                            className="mt-6 inline-flex items-center gap-2 h-9 px-4 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/5 transition-colors press"
                            style={{ color: 'var(--fg-1)' }}
                        >
                            <Users className="size-3.5" /> Manage friends
                        </button>
                    </div>

                    <div className="col-span-7 space-y-2">
                        {rooms.slice(0, 5).map((r, i) => (
                            <div key={r._id}
                                className="flex items-center gap-4 p-4 rounded-xl ring-1 ring-white/8 press hover:ring-white/20 cursor-pointer transition-all"
                                style={{ background: 'var(--ink-2)' }}
                                onClick={() => handleJoin(r._id)}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-full object-cover bg-white/10 ring-2 ring-white/10"
                                        style={{ background: `oklch(0.5 0.15 ${(i * 72) % 360})` }} />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[var(--ink-0)] bg-[oklch(0.74_0.14_160)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-white">
                                        <span className="font-medium">A friend</span>
                                        <span style={{ color: 'var(--fg-2)' }}> is listening to </span>
                                        <span className="font-medium italic serif text-[16px]">{r.title}</span>
                                    </p>
                                    <p className="text-[11px] mt-0.5 mono uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>
                                        just now · {r.listenerCount.toLocaleString()} listeners
                                    </p>
                                </div>
                                <img src={r.playlist[0]?.imageUrl ?? FALLBACK} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                                <button
                                    onClick={e => { e.stopPropagation(); handleJoin(r._id) }}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/8 press shrink-0"
                                    style={{ color: 'var(--fg-1)' }}
                                >
                                    Join <ArrowRight className="size-3" />
                                </button>
                            </div>
                        ))}
                        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
                    </div>
                </div>
            </section>

            {/* ── 5. Station of the Week ───────────────────────────────────── */}
            {featured && (
                <section className="mx-10 my-20 rounded-[28px] overflow-hidden relative ring-1 ring-white/10">
                    <img src={featured.playlist[0]?.imageUrl ?? FALLBACK} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg, oklch(0.1 0.02 285 / 0.9) 30%, oklch(0.1 0.02 285 / 0.4) 70%, transparent 100%)' }} />

                    <div className="relative grid grid-cols-12 gap-10 p-14 min-h-[440px]">
                        <div className="col-span-7 flex flex-col justify-between">
                            <div>
                                <div className="mono text-[10px] uppercase tracking-[0.3em] text-[oklch(0.88_0.12_75)]">Station of the week · Volume 012</div>
                                <h2 className="serif text-white mt-4 italic leading-[0.95]" style={{ fontSize: 72 }}>{featured.title}</h2>
                                <p className="mt-6 text-[16px] text-white/80 max-w-[500px] leading-relaxed">
                                    {featured.description || '"A set that begins at 11pm sharp, every Friday. Real listeners, real songs, same second."'}
                                    {featured.creatorId?.fullName && ` — hosted by ${featured.creatorId.fullName}.`}
                                </p>
                            </div>

                            <div className="flex items-center gap-6 mt-10">
                                <button className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press">
                                    <Bell className="size-3.5" /> Set reminder
                                </button>
                                <button onClick={() => handleJoin(featured._id)} className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/20 text-white text-[14px] hover:bg-white/8 press">
                                    <Play className="size-3.5" /> Join room
                                </button>
                                <span className="mono text-[11px] text-white/50 uppercase tracking-widest">Next set in 02:14:33</span>
                            </div>
                        </div>

                        <div className="col-span-5 flex flex-col gap-4">
                            {featured.creatorId && (
                                <div className="rounded-2xl p-5 ring-1 ring-white/10" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
                                    <div className="flex items-center gap-3 mb-4">
                                        {featured.creatorId.imageUrl && (
                                            <img src={featured.creatorId.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20" alt="" />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-[14px] text-white">{featured.creatorId.fullName}</p>
                                            <p className="text-[11px] text-white/50">Creator · 48,210 followers</p>
                                        </div>
                                        <button className="inline-flex items-center gap-2 h-8 px-3 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">Follow</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {[['Rooms hosted', '142'], ['Listeners reached', '1.2M'], ['Hrs streamed', '890']].map(([l, v]) => (
                                            <div key={l} className="p-3 rounded-lg bg-white/5">
                                                <p className="mono text-[9px] uppercase tracking-wider text-white/50">{l}</p>
                                                <p className="mono text-[16px] text-white mt-1 tabular-nums">{v}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl p-5 ring-1 ring-white/10" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
                                <div className="mono text-[9px] uppercase tracking-widest text-white/50 mb-3">Upcoming</div>
                                {[
                                    ['Tonight · 11:00 PM', 'Late Night Lullabies Vol. 13'],
                                    ['Sat · 9:00 PM', 'Collab w/ Remy Okafor'],
                                    ['Sun · 10:00 AM', 'Slow Sunday'],
                                ].map(([t, title]) => (
                                    <div key={t} className="flex items-center gap-3 py-2.5 border-b border-white/8 last:border-0">
                                        <span className="mono text-[10px] text-white/60 uppercase tracking-wider w-32">{t}</span>
                                        <span className="text-[13px] text-white flex-1">{title}</span>
                                        <button className="text-white/50 hover:text-white text-[11px]">+</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── 6. Creator Goals ─────────────────────────────────────────── */}
            <section className="px-10 py-16 relative">
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>Creator economy</div>
                        <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>Back the next album.</h2>
                        <p className="mt-2 text-[15px] leading-relaxed max-w-[520px]" style={{ color: 'var(--fg-2)' }}>
                            Coin-based stream goals fund studio time, travel, and mastering. When a goal hits, the creator earns out in real money.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/goal')}
                        className="inline-flex items-center gap-1 text-[12px] hover:text-white transition-colors"
                        style={{ color: 'var(--fg-2)' }}
                    >
                        View all <ChevronRight className="size-3.5" />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-5">
                    {STATIC_GOALS.map((g, i) => <AlbumGoalCard key={i} {...g} />)}
                </div>
            </section>

            {/* ── 7. Moods Grid ────────────────────────────────────────────── */}
            <section className="px-10 py-16 border-t hair" style={{ background: 'var(--ink-1)' }}>
                <div className="mb-8">
                    <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>By mood</div>
                    <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>What's the room for?</h2>
                </div>
                <div className="grid grid-cols-6 gap-3">
                    {MOODS.map((m, i) => {
                        const hue = 230 + (i * 17) % 180
                        return (
                            <button
                                key={m}
                                onClick={() => navigate(`/rooms?tags=${encodeURIComponent(m)}`)}
                                className="press relative rounded-xl overflow-hidden ring-1 ring-white/10 hover:ring-white/30 transition-all group"
                                style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, oklch(0.3 0.09 ${hue}), oklch(0.18 0.04 ${hue + 30}))` }}
                            >
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'oklch(1 0 0 / 0.06)' }} />
                                <span className="absolute bottom-3 left-3 serif text-[20px] text-white italic">{m}</span>
                                <span className="absolute top-3 right-3 mono text-[9px] uppercase tracking-wider text-white/50">
                                    {(20 + i * 13) % 48} rooms
                                </span>
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* ── 8. Footer ────────────────────────────────────────────────── */}
            <footer className="px-10 py-12 border-t hair">
                <div className="flex items-baseline justify-between">
                    <span className="serif italic text-white/70" style={{ fontSize: 24 }}>
                        spacic<span className="mono not-italic text-[10px] ml-1" style={{ color: 'var(--fg-3)' }}>.fm</span>
                    </span>
                    <div className="flex gap-8 text-[12px]" style={{ color: 'var(--fg-3)' }}>
                        <a href="#" className="hover:text-white transition-colors">About</a>
                        <a href="#" className="hover:text-white transition-colors">For creators</a>
                        <a href="#" className="hover:text-white transition-colors">Press kit</a>
                        <a href="#" className="hover:text-white transition-colors">Privacy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default HomePage
