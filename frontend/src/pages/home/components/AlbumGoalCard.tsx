import { Gem } from 'lucide-react'
import { COVER_FALLBACKS } from './shared'

interface Props {
    title: string
    artist: string
    cover: string
    raised: number
    goal: number
    days: number
}

export const AlbumGoalCard = ({ title, artist, cover, raised, goal, days }: Props) => {
    const pct = Math.min(100, Math.round((raised / goal) * 100))
    const covers = [
        cover,
        COVER_FALLBACKS[(COVER_FALLBACKS.indexOf(cover) + 1) % COVER_FALLBACKS.length],
        COVER_FALLBACKS[(COVER_FALLBACKS.indexOf(cover) + 2) % COVER_FALLBACKS.length],
    ]
    return (
        <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 press hover:ring-white/20 transition-all" style={{ background: 'var(--ink-1)' }}>
            <div className="relative h-28 flex"
                style={{ background: 'linear-gradient(135deg, oklch(0.22 0.04 295), oklch(0.2 0.04 60))' }}>
                <div className="flex-1 flex items-center gap-2 px-4">
                    {covers.map((c, j) => (
                        <img key={j} src={c} className="w-12 h-12 rounded-md object-cover ring-1 ring-white/20"
                            style={{ transform: `rotate(${(j - 1) * 4}deg) translateY(${j === 1 ? -4 : 0}px)` }} alt="" />
                    ))}
                </div>
                <div className="p-3 self-end">
                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.82_0.15_75_/_0.14)] text-[oklch(0.88_0.12_75)] ring-1 ring-[oklch(0.82_0.15_75_/_0.35)]">
                        <Gem className="size-2.5" /> ${raised.toLocaleString()} / ${goal.toLocaleString()}
                    </span>
                </div>
            </div>
            <div className="p-5">
                <p className="text-[12px] mb-1" style={{ color: 'var(--fg-2)' }}>{artist}</p>
                <h4 className="serif text-[22px] leading-tight text-white">{title}</h4>
                <div className="mt-4 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                    </div>
                    <span className="mono text-[11px] text-white tabular-nums">{pct}%</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>{days} days left</span>
                    <button className="h-7 px-3 rounded-lg bg-[oklch(0.88_0.12_75)] text-[oklch(0.18_0.02_80)] text-[11px] font-semibold press">
                        Contribute
                    </button>
                </div>
            </div>
        </div>
    )
}
