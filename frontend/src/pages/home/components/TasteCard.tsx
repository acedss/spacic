import { Play } from 'lucide-react'
import { FALLBACK, type RoomData } from './shared'
import { LiveDot } from './Primitives'

export const TasteCard = ({ room, onJoin }: { room: RoomData; onJoin: (id: string) => void }) => {
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
