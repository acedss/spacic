import { X } from 'lucide-react'
import { TAG_GRADIENTS } from './constants'

interface Props {
    activeTags: string[]
    onRemove: (tag: string) => void
    onClear: () => void
    showMoodGrid: boolean
    onToggleGrid: () => void
}

export const ActiveTagsBar = ({ activeTags, onRemove, onClear, showMoodGrid, onToggleGrid }: Props) => (
    <div className="flex flex-wrap items-center gap-2">
        {activeTags.map(tag => (
            <div key={tag} className="flex items-center gap-1.5 h-8 px-3 rounded-full ring-1 ring-white/20"
                style={{ background: TAG_GRADIENTS[tag] ?? 'var(--ink-2)' }}>
                <span className="serif italic text-white text-[13px]">{tag}</span>
                <button onClick={() => onRemove(tag)} className="press" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <X className="size-3" />
                </button>
            </div>
        ))}
        <button onClick={onClear}
            className="mono text-[10px] uppercase tracking-wider h-8 px-3 rounded-full ring-1 ring-white/10 hover:bg-white/5 press"
            style={{ color: 'var(--fg-3)' }}>
            Clear all
        </button>
        <button onClick={onToggleGrid}
            className="mono text-[10px] uppercase tracking-wider press" style={{ color: 'var(--fg-3)' }}>
            {showMoodGrid ? 'Hide moods' : '+ Add mood'}
        </button>
    </div>
)
