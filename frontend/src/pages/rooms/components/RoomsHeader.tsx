import { Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SORT_OPTIONS, type SortOption } from './constants'

interface Props {
    search: string
    setSearch: (v: string) => void
    sort: SortOption
    setSort: (v: SortOption) => void
}

export const RoomsHeader = ({ search, setSearch, sort, setSort }: Props) => (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
            <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Discovery</p>
            <h1 className="serif italic text-white" style={{ fontSize: 34 }}>Live Rooms</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--fg-3)' }} />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search rooms…"
                    className="pl-9 pr-3 h-9 rounded-xl ring-1 ring-white/10 text-[13px] text-white outline-none w-48"
                    style={{ background: 'var(--ink-2)', color: 'var(--fg-1)' }}
                />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl ring-1 ring-white/8" style={{ background: 'var(--ink-2)' }}>
                <SlidersHorizontal className="size-3.5 ml-1 mr-0.5 shrink-0" style={{ color: 'var(--fg-3)' }} />
                {SORT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setSort(opt.value)}
                        className={cn('mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all press',
                            sort === opt.value ? 'bg-white/10 text-white ring-1 ring-white/10' : 'hover:text-white'
                        )}
                        style={{ color: sort === opt.value ? undefined : 'var(--fg-3)' }}>
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
)
