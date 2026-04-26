import { TAG_ORDER } from './constants'
import { MoodCard } from './MoodCard'

interface Props {
    activeTags: string[]
    onToggle: (tag: string) => void
    countFor: (tag: string) => number
    titled?: boolean
    compact?: boolean
}

export const MoodGrid = ({ activeTags, onToggle, countFor, titled = false, compact = false }: Props) => {
    const grid = (
        <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 ${compact ? 'gap-2' : 'gap-3'}`}>
            {TAG_ORDER.map(tag => (
                <MoodCard key={tag} tag={tag} count={countFor(tag)} active={activeTags.includes(tag)} onClick={() => onToggle(tag)} />
            ))}
        </div>
    )
    if (!titled) return grid
    return (
        <section className="space-y-4">
            <div>
                <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>By mood</p>
                <h2 className="serif italic text-white" style={{ fontSize: 28 }}>What's the room for?</h2>
            </div>
            {grid}
        </section>
    )
}
