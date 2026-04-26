import { Radio, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { RoomInfo } from '@/types/types'

export const RoomCard = ({ room }: { room: RoomInfo }) => {
    const navigate = useNavigate()
    const isLive = room.status === 'live'
    const song = room.playlist[room.playback?.currentSongIndex ?? 0]
    const cover = room.coverImageUrl || song?.imageUrl || null

    return (
        <button
            onClick={() => navigate(`/rooms/${room._id}`)}
            className="group text-left rounded-2xl overflow-hidden ring-1 ring-white/8 hover:ring-white/20 transition-all press"
            style={{ background: 'var(--ink-2)' }}
        >
            <div className="aspect-[4/3] relative overflow-hidden" style={{ background: 'var(--ink-1)' }}>
                {cover ? (
                    <img src={cover} alt={room.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full grid place-items-center">
                        <Radio className="size-8" style={{ color: 'var(--fg-3)' }} />
                    </div>
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, oklch(0.08 0.015 285 / 0.9) 100%)' }} />

                {isLive ? (
                    <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 mono text-[9px] font-bold text-white px-2.5 py-1 rounded-full"
                        style={{ background: 'oklch(0.72 0.22 20 / 0.9)' }}>
                        <span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE
                    </span>
                ) : (
                    <span className="absolute top-2.5 left-2.5 mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{ background: 'oklch(0.1 0.01 285 / 0.7)', color: 'var(--fg-3)' }}>
                        Offline
                    </span>
                )}

                {room.tags && room.tags.length > 0 && (
                    <div className="absolute bottom-2.5 left-2.5 flex gap-1 flex-wrap">
                        {room.tags.slice(0, 2).map(t => (
                            <span key={t} className="mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ background: 'oklch(0.1 0.01 285 / 0.8)', color: 'var(--fg-2)' }}>
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3.5 space-y-1.5">
                <p className="text-[14px] font-semibold text-white truncate leading-tight">{room.title}</p>
                {song && <p className="mono text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>{song.title} — {song.artist}</p>}

                <div className="flex items-center gap-3 mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
                    {isLive && (
                        <span className="flex items-center gap-1 text-[oklch(0.82_0.17_20)]">
                            <Users className="size-3" />
                            {(room.listenerCount ?? 0).toLocaleString()}
                        </span>
                    )}
                    {room.streamGoal > 0 && (
                        <span className="flex items-center gap-1">
                            💎 {room.streamGoalCurrent.toLocaleString()}/{room.streamGoal.toLocaleString()}
                        </span>
                    )}
                </div>

                {room.streamGoal > 0 && (
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-1)' }}>
                        <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (room.streamGoalCurrent / room.streamGoal) * 100)}%`,
                            background: 'oklch(0.88 0.12 75)',
                        }} />
                    </div>
                )}
            </div>
        </button>
    )
}
