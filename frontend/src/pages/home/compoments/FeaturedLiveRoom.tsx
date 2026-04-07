import { useEffect, useRef, useState } from 'react'
import { Heart, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RoomCard } from './RoomCard'
import { getPublicRooms, toggleFavorite, getFavoriteStatus } from '@/lib/roomService'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAuth } from '@clerk/clerk-react'

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

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'

const goalProgress = (room: RoomData) =>
    room.streamGoal > 0
        ? Math.round((room.streamGoalCurrent / room.streamGoal) * 100)
        : 0

export const FeaturedLiveRoom = () => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const { userId } = useAuth()
    const [rooms, setRooms] = useState<RoomData[]>([])
    const [loading, setLoading] = useState(true)
    const [featuredFavorited, setFeaturedFavorited] = useState(false)

    useEffect(() => {
        getPublicRooms({ limit: 10, sort: 'listener_count' })
            .then((res) => setRooms(res.data ?? []))
            .catch(() => setRooms([]))
            .finally(() => setLoading(false))
    }, [])

    // Check favorite status for featured room once loaded
    useEffect(() => {
        if (!userId || rooms.length === 0) return
        getFavoriteStatus(rooms[0]._id)
            .then(fav => setFeaturedFavorited(fav))
            .catch(() => {})
    }, [userId, rooms])

    const handleFeaturedFavorite = async () => {
        if (!userId) { navigate('/sign-in'); return }
        try {
            const { favorited } = await toggleFavorite(rooms[0]._id)
            setFeaturedFavorited(favorited)
            toast.success(favorited ? 'Added to favorites' : 'Removed from favorites')
        } catch {
            toast.error('Could not update favorites')
        }
    }

    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({
            left: dir === 'right' ? 300 : -300,
            behavior: 'smooth',
        })
    }

    if (loading) {
        return (
            <section>
                <h2 className='text-2xl font-semibold tracking-tight mb-6'>Featured Live Room</h2>
                <div className='w-full rounded-[32px] overflow-hidden border border-white/10 flex flex-col lg:flex-row'>
                    <Skeleton className='w-full lg:w-1/2 h-64 lg:h-72 bg-zinc-900' />
                    <div className='w-full lg:w-1/2 p-8 lg:p-12 space-y-4 bg-zinc-900'>
                        <Skeleton className='h-8 w-3/4 bg-white/5' />
                        <Skeleton className='h-5 w-1/2 bg-white/5' />
                        <Skeleton className='h-4 w-full bg-white/5 mt-4' />
                        <Skeleton className='h-2 w-full bg-white/5' />
                        <div className='flex gap-4 pt-4'>
                            <Skeleton className='h-14 w-40 rounded-2xl bg-white/5' />
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    if (rooms.length === 0) {
        return (
            <section>
                <h2 className='text-2xl font-semibold tracking-tight mb-6'>Featured Live Room</h2>
                <div className='w-full rounded-[32px] bg-zinc-900 border border-white/10 h-40 flex items-center justify-center text-zinc-500 text-sm'>
                    No active rooms right now.
                </div>
            </section>
        )
    }

    const featured = rooms[0]
    const rest = rooms.slice(1)
    const featuredImage = featured.playlist[0]?.imageUrl ?? FALLBACK_IMAGE
    const featuredArtist = featured.playlist[0]?.artist ?? featured.creatorId?.fullName ?? '—'
    const featuredProgress = goalProgress(featured)

    return (
        <section>
            <h2 className='text-2xl font-semibold tracking-tight mb-6'>Featured Live Room</h2>

            {/* Hero card */}
            <div className='relative w-full rounded-[32px] overflow-hidden bg-zinc-900 border border-white/10 group mb-8'>
                <div className='flex flex-col lg:flex-row'>

                    {/* Album art */}
                    <div className='w-full lg:w-1/2 relative h-64 lg:h-105 overflow-hidden'>
                        <img
                            src={featuredImage}
                            alt={featured.title}
                            className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-105'
                        />
                        <div className='absolute inset-0 bg-linear-to-t lg:bg-linear-to-r from-black/80 via-black/20 to-transparent' />
                        <div className='absolute top-6 left-6 px-3 py-1.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-2'>
                            <span className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
                            <span className='text-xs font-bold uppercase tracking-[0.2em]'>Live Now</span>
                        </div>
                    </div>

                    {/* Room info */}
                    <div className='w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center space-y-6'>
                        <div>
                            <h3 className='text-4xl lg:text-5xl font-bold tracking-tight mb-2'>{featured.title}</h3>
                            <p className='text-xl text-zinc-400'>{featuredArtist}</p>
                            {featured.description && (
                                <p className='text-sm text-zinc-500 mt-2'>{featured.description}</p>
                            )}
                        </div>
                        <div className='space-y-3 max-w-md'>
                            <div className='flex justify-between text-sm text-zinc-400 font-medium'>
                                <span>Album Funding Progress</span>
                                <span className='text-white'>{featuredProgress}%</span>
                            </div>
                            <Progress value={featuredProgress} className="h-2 bg-white/5 [&>div]:bg-white [&>div]:transition-all [&>div]:duration-500" />
                            <p className='text-xs text-zinc-500'>
                                {featured.listenerCount.toLocaleString()} listener{featured.listenerCount !== 1 ? 's' : ''} currently in room
                            </p>
                        </div>
                        <div className='flex gap-4 pt-4'>
                            <Button
                                onClick={() => navigate(`/rooms/${featured._id}`)}
                                className='px-10 py-4 h-auto bg-white text-black text-base font-bold rounded-2xl hover:bg-zinc-200 active:scale-95'
                            >
                                Join Room
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleFeaturedFavorite}
                                className={`size-14 rounded-2xl border border-white/5 transition-all ${
                                    featuredFavorited
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                <Heart className={`size-5 ${featuredFavorited ? 'fill-red-400' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Other Active Rooms */}
            {rest.length > 0 && (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                        <h3 className='text-lg font-medium text-zinc-400'>Other Active Rooms</h3>
                        <div className='flex gap-1'>
                            <Button variant="ghost" size="icon-sm" onClick={() => scroll('left')} className="text-zinc-500 hover:text-white">
                                <ChevronLeft className='size-5' />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => scroll('right')} className="text-zinc-500 hover:text-white">
                                <ChevronRight className='size-5' />
                            </Button>
                        </div>
                    </div>
                    <div
                        ref={scrollRef}
                        className='flex gap-6 overflow-x-auto pb-4 snap-x'
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {rest.map((room) => (
                            <RoomCard
                                key={room._id}
                                id={room._id}
                                title={room.title}
                                artist={room.playlist[0]?.artist ?? room.creatorId?.fullName ?? '—'}
                                image={room.playlist[0]?.imageUrl ?? FALLBACK_IMAGE}
                                progress={goalProgress(room)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
