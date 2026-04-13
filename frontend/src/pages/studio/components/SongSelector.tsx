import { useState } from 'react'
import { Search, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { Song } from '@/types/types'

export const SongSelector = ({ songs, selectedIds, onChange, disabled }: {
    songs: Song[]; selectedIds: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) => {
    const [query, setQuery] = useState('')
    const filtered = songs.filter(s =>
        query.trim() === '' ||
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
    )
    const toggle = (id: string) =>
        onChange(selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id])

    return (
        <div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                <Input
                    placeholder="Search…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9 text-sm"
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{selectedIds.length} selected</span>
                {selectedIds.length > 0 && (
                    <button onClick={() => onChange([])} className="text-xs text-zinc-500 hover:text-white transition-colors">
                        Clear all
                    </button>
                )}
            </div>
            <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                    <p className="text-zinc-600 text-xs text-center py-6">No songs found</p>
                ) : filtered.map(song => {
                    const selected = selectedIds.includes(song._id)
                    return (
                        <button
                            key={song._id}
                            type="button"
                            onClick={() => toggle(song._id)}
                            className={cn(
                                'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all text-left group',
                                selected ? 'bg-white/8' : 'hover:bg-white/5',
                            )}
                        >
                            <div className="relative flex-shrink-0">
                                <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover" />
                                {selected && (
                                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                                        <Check className="size-4 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate transition-colors', selected ? 'text-white' : 'text-zinc-300 group-hover:text-white')}>
                                    {song.title}
                                </p>
                                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                            </div>
                            <div className={cn(
                                'flex-shrink-0 size-6 rounded-full border flex items-center justify-center transition-all',
                                selected ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 text-zinc-600 group-hover:border-white/20',
                            )}>
                                {selected ? <Check className="size-3" /> : <Plus className="size-3" />}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
