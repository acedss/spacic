import { ArrowRight, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { FALLBACK, type RoomData } from './shared'

interface Props {
    rooms: RoomData[]
    loading: boolean
    onJoin: (id: string) => void
}

export const FriendsActivitySection = ({ rooms, loading, onJoin }: Props) => {
    const navigate = useNavigate()
    return (
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
                    <button onClick={() => navigate('/friends')}
                        className="mt-6 inline-flex items-center gap-2 h-9 px-4 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/5 transition-colors press"
                        style={{ color: 'var(--fg-1)' }}>
                        <Users className="size-3.5" /> Manage friends
                    </button>
                </div>

                <div className="col-span-7 space-y-2">
                    {rooms.slice(0, 5).map((r, i) => (
                        <div key={r._id}
                            className="flex items-center gap-4 p-4 rounded-xl ring-1 ring-white/8 press hover:ring-white/20 cursor-pointer transition-all"
                            style={{ background: 'var(--ink-2)' }}
                            onClick={() => onJoin(r._id)}>
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
                            <button onClick={e => { e.stopPropagation(); onJoin(r._id) }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/8 press shrink-0"
                                style={{ color: 'var(--fg-1)' }}>
                                Join <ArrowRight className="size-3" />
                            </button>
                        </div>
                    ))}
                    {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
                </div>
            </div>
        </section>
    )
}
