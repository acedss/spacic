import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { getFavoriteRooms, toggleFavorite } from '@/lib/roomService'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { RoomInfo } from '@/types/types'
import { RoomFavoriteCard } from './components/RoomFavoriteCard'

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

export default FavoritesPage
