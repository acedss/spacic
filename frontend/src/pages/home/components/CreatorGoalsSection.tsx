import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { STATIC_GOALS } from './shared'
import { AlbumGoalCard } from './AlbumGoalCard'

export const CreatorGoalsSection = () => {
    const navigate = useNavigate()
    return (
        <section className="px-10 py-16 relative">
            <div className="flex items-end justify-between mb-8">
                <div>
                    <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>Creator economy</div>
                    <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>Back the next album.</h2>
                    <p className="mt-2 text-[15px] leading-relaxed max-w-[520px]" style={{ color: 'var(--fg-2)' }}>
                        Coin-based stream goals fund studio time, travel, and mastering. When a goal hits, the creator earns out in real money.
                    </p>
                </div>
                <button onClick={() => navigate('/goal')}
                    className="inline-flex items-center gap-1 text-[12px] hover:text-white transition-colors"
                    style={{ color: 'var(--fg-2)' }}>
                    View all <ChevronRight className="size-3.5" />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-5">
                {STATIC_GOALS.map((g, i) => <AlbumGoalCard key={i} {...g} />)}
            </div>
        </section>
    )
}
