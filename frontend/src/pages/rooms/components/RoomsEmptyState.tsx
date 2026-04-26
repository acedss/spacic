import { Radio } from 'lucide-react'

interface Props {
    debouncedSearch: string
    activeTags: string[]
    onClear: () => void
}

export const RoomsEmptyState = ({ debouncedSearch, activeTags, onClear }: Props) => (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <Radio className="size-12 opacity-20 text-white" />
        <p className="text-[14px] text-white">No rooms found</p>
        <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
            {debouncedSearch
                ? 'Try a different search term'
                : activeTags.length
                    ? `No rooms tagged "${activeTags.join(', ')}" yet`
                    : 'Check back soon for live sessions'}
        </p>
        {activeTags.length > 0 && (
            <button onClick={onClear} className="h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press mt-1">
                Clear filters
            </button>
        )}
    </div>
)
