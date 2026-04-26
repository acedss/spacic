import { useNavigate } from 'react-router-dom'
import { MOODS } from './shared'

export const MoodsGridSection = () => {
    const navigate = useNavigate()
    return (
        <section className="px-10 py-16 border-t hair" style={{ background: 'var(--ink-1)' }}>
            <div className="mb-8">
                <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>By mood</div>
                <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>What's the room for?</h2>
            </div>
            <div className="grid grid-cols-6 gap-3">
                {MOODS.map((m, i) => {
                    const hue = 230 + (i * 17) % 180
                    return (
                        <button key={m}
                            onClick={() => navigate(`/rooms?tags=${encodeURIComponent(m)}`)}
                            className="press relative rounded-xl overflow-hidden ring-1 ring-white/10 hover:ring-white/30 transition-all group"
                            style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, oklch(0.3 0.09 ${hue}), oklch(0.18 0.04 ${hue + 30}))` }}>
                            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'oklch(1 0 0 / 0.06)' }} />
                            <span className="absolute bottom-3 left-3 serif text-[20px] text-white italic">{m}</span>
                            <span className="absolute top-3 right-3 mono text-[9px] uppercase tracking-wider text-white/50">
                                {(20 + i * 13) % 48} rooms
                            </span>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
