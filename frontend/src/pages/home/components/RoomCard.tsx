import { Play } from 'lucide-react'
import { FALLBACK, goalPct, type RoomData } from './shared'
import { Equalizer, LiveDot } from './Primitives'

export const RoomCard = ({ room, onJoin }: { room: RoomData; onJoin: (id: string) => void }) => {
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
