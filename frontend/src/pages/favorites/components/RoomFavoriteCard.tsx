import { Heart, Users, Radio } from 'lucide-react'
import type { RoomInfo } from '@/types/types'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'

export interface RoomFavoriteCardProps {
    room: RoomInfo
    onUnfavorite: (e: React.MouseEvent, roomId: string) => void
    onClick: () => void
}

export const RoomFavoriteCard = ({ room, onUnfavorite, onClick }: RoomFavoriteCardProps) => {
    const isLive = room.status === 'live'
    const image = (room.playlist as any[])?.[0]?.imageUrl ?? FALLBACK_IMAGE
    const artist = (room.playlist as any[])?.[0]?.artist ?? (room.creatorId as any)?.fullName ?? '—'

    return (
        <div
            onClick={onClick}
            className='relative group cursor-pointer rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-white/15 transition-all'
        >
            <div className='relative h-32 overflow-hidden'>
                <img src={image} alt={room.title} className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105' />
                <div className='absolute inset-0 bg-gradient-to-t from-zinc-900 via-black/30 to-transparent' />

                {isLive && (
                    <div className='absolute top-3 left-3 px-2 py-1 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center gap-1.5'>
                        <span className='w-1.5 h-1.5 rounded-full bg-white animate-pulse' />
                        <span className='text-[10px] font-bold uppercase tracking-wider text-white'>Live</span>
                    </div>
                )}

                <button
                    onClick={e => onUnfavorite(e, room._id)}
                    className='absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100'
                >
                    <Heart className='size-3.5 text-red-400 fill-red-400' />
                </button>
            </div>

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
