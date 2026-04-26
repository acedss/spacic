import { Radio } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { RoomData } from './shared'
import { RoomCard } from './RoomCard'

type Filter = 'All' | 'For you' | 'Friends' | 'Nearby'

interface Props {
    liveNow: RoomData[]
    loading: boolean
    filter: Filter
    setFilter: (f: Filter) => void
    onJoin: (id: string) => void
}

export const LiveNowSection = ({ liveNow, loading, filter, setFilter, onJoin }: Props) => (
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
                        <button key={f} onClick={() => setFilter(f)}
                            className={`chip rounded-full px-3 py-1.5 ring-1 ring-white/12 ${filter === f ? 'chip-on' : ''}`}>
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
                        {liveNow.slice(0, 4).map(r => <RoomCard key={r._id} room={r} onJoin={onJoin} />)}
                    </div>
                    {liveNow.length > 4 && (
                        <div className="mt-5 grid grid-cols-4 gap-5">
                            {liveNow.slice(4, 8).map(r => <RoomCard key={r._id} room={r} onJoin={onJoin} />)}
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
)
