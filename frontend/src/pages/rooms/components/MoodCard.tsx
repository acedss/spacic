import { cn } from '@/lib/utils'
import { TAG_GRADIENTS } from './constants'

interface Props {
    tag: string
    count: number
    active: boolean
    onClick: () => void
}

export const MoodCard = ({ tag, count, active, onClick }: Props) => (
    <button
        onClick={onClick}
        className={cn('relative rounded-2xl overflow-hidden text-left press transition-all',
            active ? 'ring-2 ring-white/60' : 'ring-1 ring-white/10 hover:ring-white/25')}
        style={{ background: TAG_GRADIENTS[tag] ?? 'var(--ink-2)', aspectRatio: '4/3' }}
    >
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
            <p className="mono text-[9px] uppercase tracking-widest text-white/50 text-right">{count} rooms</p>
            <p className="serif italic text-white" style={{ fontSize: 22, lineHeight: 1.1 }}>{tag}</p>
        </div>
    </button>
)
