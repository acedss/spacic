import { useNavigate } from 'react-router-dom'

interface RoomCardProps {
    id: string
    title: string
    artist: string
    image: string
    progress: number
    dimmed?: boolean
}

export const RoomCard = ({ id, title, artist, image, progress, dimmed = false }: RoomCardProps) => {
    const navigate = useNavigate()

    return (
        <div className={`flex-none w-72 snap-start group bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all ${dimmed ? 'opacity-60 hover:opacity-100' : ''}`}>
            <div className='aspect-video relative overflow-hidden'>
                <img
                    src={image}
                    alt={title}
                    className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-110'
                />
                <div className='absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors' />
            </div>
            <div className='p-4 space-y-3'>
                <div>
                    <h4 className='font-semibold text-base leading-tight truncate'>{title}</h4>
                    <p className='text-xs text-zinc-500 mt-0.5'>{artist}</p>
                </div>
                <div className='w-full bg-white/5 h-1 rounded-full overflow-hidden'>
                    <div className='bg-white h-full rounded-full' style={{ width: `${progress}%` }} />
                </div>
                <button
                    onClick={() => navigate(`/rooms/${id}`)}
                    className='w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-lg transition-all'
                >
                    Join Room
                </button>
            </div>
        </div>
    )
}
