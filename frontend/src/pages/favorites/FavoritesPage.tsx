import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Radio, Users } from 'lucide-react'
import { getFavoriteRooms, toggleFavorite } from '@/lib/roomService'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { RoomInfo } from '@/types/types'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'

export const FavoritesPage = () => {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState<RoomInfo[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getFavoriteRooms()
            .then(res => setRooms(res.data ?? []))
            .catch(() => setRooms([]))
            .finally(() => setLoading(false))
    }, [])

    const handleUnfavorite = async (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation()
        try {
            await toggleFavorite(roomId)
            setRooms(prev => prev.filter(r => r._id !== roomId))
            toast.success('Removed from favorites')
        } catch {
            toast.error('Could not update favorites')
        }
    }

    if (loading) {
        return (
            <div className='p-8 space-y-6'>
                <h1 className='text-3xl font-bold'>Favorites</h1>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className='h-44 rounded-2xl bg-white/5' />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className='p-8 space-y-6'>
            <div className='flex items-center gap-3'>
                <Heart className='size-7 text-red-400 fill-red-400' />
                <h1 className='text-3xl font-bold'>Favorites</h1>
            </div>

            {rooms.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-24 text-zinc-500 gap-4'>
                    <Heart className='size-12 opacity-30' />
                    <p className='text-sm'>No favorited rooms yet.</p>
                    <Button variant='ghost' onClick={() => navigate('/')} className='text-zinc-400 hover:text-white'>
                        Browse live rooms
                    </Button>
                </div>
            ) : (
                <>
                    {/* Live rooms section */}
                    {rooms.some(r => r.status === 'live') && (
                        <section className='space-y-3'>
                            <h2 className='text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2'>
                                <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                                Live Now
                            </h2>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                                {rooms.filter(r => r.status === 'live').map(room => (
                                    <RoomFavoriteCard
                                        key={room._id}
                                        room={room}
                                        onUnfavorite={handleUnfavorite}
                                        onClick={() => navigate(`/rooms/${room._id}`)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Offline rooms section */}
                    {rooms.some(r => r.status === 'offline') && (
                        <section className='space-y-3'>
                            <h2 className='text-sm font-semibold text-zinc-400 uppercase tracking-wider'>
                                Offline
                            </h2>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                                {rooms.filter(r => r.status === 'offline').map(room => (
                                    <RoomFavoriteCard
                                        key={room._id}
                                        room={room}
                                        onUnfavorite={handleUnfavorite}
                                        onClick={() => navigate(`/rooms/${room._id}`)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}

interface RoomFavoriteCardProps {
    room: RoomInfo
    onUnfavorite: (e: React.MouseEvent, roomId: string) => void
    onClick: () => void
}

const RoomFavoriteCard = ({ room, onUnfavorite, onClick }: RoomFavoriteCardProps) => {
    const isLive = room.status === 'live'
    const image = (room.playlist as any[])?.[0]?.imageUrl ?? FALLBACK_IMAGE
    const artist = (room.playlist as any[])?.[0]?.artist ?? (room.creatorId as any)?.fullName ?? '—'

    return (
        <div
            onClick={onClick}
            className='relative group cursor-pointer rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-white/15 transition-all'
        >
            {/* Thumbnail */}
            <div className='relative h-32 overflow-hidden'>
                <img src={image} alt={room.title} className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105' />
                <div className='absolute inset-0 bg-gradient-to-t from-zinc-900 via-black/30 to-transparent' />

                {isLive && (
                    <div className='absolute top-3 left-3 px-2 py-1 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center gap-1.5'>
                        <span className='w-1.5 h-1.5 rounded-full bg-white animate-pulse' />
                        <span className='text-[10px] font-bold uppercase tracking-wider text-white'>Live</span>
                    </div>
                )}

                {/* Unfavorite button */}
                <button
                    onClick={e => onUnfavorite(e, room._id)}
                    className='absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100'
                >
                    <Heart className='size-3.5 text-red-400 fill-red-400' />
                </button>
            </div>

            {/* Info */}
            <div className='p-4'>
                <p className='text-sm font-semibold truncate'>{room.title}</p>
                <p className='text-xs text-zinc-500 truncate mt-0.5'>{artist}</p>
                <div className='flex items-center gap-3 mt-2 text-xs text-zinc-500'>
                    {isLive ? (
                        <span className='flex items-center gap-1'>
                            <Users className='size-3' />
                            {(room.listenerCount ?? 0).toLocaleString()} listening
                        </span>
                    ) : (
                        <span className='flex items-center gap-1'>
                            <Radio className='size-3' />
                            Offline
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

export default FavoritesPage
