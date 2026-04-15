// EditPlaylistDialog — live queue editor while room is broadcasting
// Lets creator reorder + add songs without going offline
import { useState, useEffect } from 'react'
import { GripVertical, Trash2, Loader2, ListMusic } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SongSelector } from './SongSelector'
import { getSongs, updateQueueWhileLive } from '@/lib/roomService'
import type { Song, RoomInfo } from '@/types/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    room: RoomInfo
    onSaved: (newPlaylist: Song[]) => void
}

export const EditPlaylistDialog = ({ open, onOpenChange, room, onSaved }: Props) => {
    const [allSongs, setAllSongs] = useState<Song[]>([])
    const [loadingSongs, setLoadingSongs] = useState(false)

    // Working copy of the ordered playlist (songs after currentSongIndex)
    const currentIdx = room.playback.currentSongIndex
    const nowPlaying = room.playlist.slice(0, currentIdx + 1) // locked — can't edit past/current
    const [queue, setQueue] = useState<Song[]>(room.playlist.slice(currentIdx + 1))

    // Track which song IDs are selected (for add-from-library)
    const queueIds = queue.map(s => s._id)

    const [saving, setSaving] = useState(false)
    const [dragIdx, setDragIdx] = useState<number | null>(null)
    const [dragOver, setDragOver] = useState<number | null>(null)

    useEffect(() => {
        if (!open) return
        setLoadingSongs(true)
        getSongs(true)
            .then(setAllSongs)
            .catch(() => toast.error('Failed to load songs'))
            .finally(() => setLoadingSongs(false))
        // Reset queue to current room state
        setQueue(room.playlist.slice(room.playback.currentSongIndex + 1))
    }, [open, room.playlist, room.playback.currentSongIndex])

    const handleSongToggle = (ids: string[]) => {
        // Build new queue: existing songs that are still selected, then add newly selected ones
        const existingKept = queue.filter(s => ids.includes(s._id))
        const existingIds = new Set(existingKept.map(s => s._id))
        const added = allSongs.filter(s => ids.includes(s._id) && !existingIds.has(s._id))
        setQueue([...existingKept, ...added])
    }

    const removeFromQueue = (idx: number) => {
        setQueue(prev => prev.filter((_, i) => i !== idx))
    }

    // Drag-to-reorder (mouse)
    const handleDragStart = (i: number) => setDragIdx(i)
    const handleDragOver = (e: React.DragEvent, i: number) => {
        e.preventDefault()
        setDragOver(i)
    }
    const handleDrop = (targetIdx: number) => {
        if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOver(null); return }
        const next = [...queue]
        const [moved] = next.splice(dragIdx, 1)
        next.splice(targetIdx, 0, moved)
        setQueue(next)
        setDragIdx(null)
        setDragOver(null)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Full playlist = locked (current + past) + new queue
            const fullPlaylistIds = [
                ...nowPlaying.map(s => s._id),
                ...queue.map(s => s._id),
            ]
            await updateQueueWhileLive(room._id, { playlistIds: fullPlaylistIds })
            onSaved([...nowPlaying, ...queue])
            onOpenChange(false)
            toast.success('Playlist updated')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update playlist')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <ListMusic className="size-4 text-violet-400" />
                        Edit Playlist
                    </DialogTitle>
                    <p className="text-xs text-zinc-500 mt-1">
                        Drag to reorder · Changes apply after current song
                    </p>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden divide-x divide-white/10 min-h-0">
                    {/* Left: current queue */}
                    <div className="w-1/2 flex flex-col overflow-hidden">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider px-4 py-2 flex-shrink-0">
                            Up next ({queue.length})
                        </p>
                        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                            {queue.length === 0 && (
                                <p className="text-zinc-600 text-xs text-center py-8">
                                    Queue is empty — add songs from the right
                                </p>
                            )}
                            {queue.map((song, i) => (
                                <div
                                    key={`q-${i}-${song._id}`}
                                    draggable
                                    onDragStart={() => handleDragStart(i)}
                                    onDragOver={(e) => handleDragOver(e, i)}
                                    onDrop={() => handleDrop(i)}
                                    onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
                                    className={cn(
                                        'flex items-center gap-2 px-2 py-2 rounded-lg transition-all cursor-grab active:cursor-grabbing',
                                        dragOver === i ? 'bg-white/10 border border-violet-500/30' : 'hover:bg-white/5',
                                        dragIdx === i && 'opacity-40'
                                    )}
                                >
                                    <GripVertical className="size-3.5 text-zinc-600 flex-shrink-0" />
                                    <span className="text-[10px] text-zinc-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                                    <img src={song.imageUrl} alt="" className="size-7 rounded object-cover flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-200 truncate">{song.title}</p>
                                        <p className="text-[10px] text-zinc-600 truncate">{song.artist}</p>
                                    </div>
                                    <button
                                        onClick={() => removeFromQueue(i)}
                                        className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-zinc-600 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: song library */}
                    <div className="w-1/2 flex flex-col overflow-hidden px-4 py-3">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex-shrink-0">Library</p>
                        {loadingSongs
                            ? <div className="flex items-center justify-center py-8"><Loader2 className="size-4 animate-spin text-zinc-500" /></div>
                            : <SongSelector
                                songs={allSongs}
                                selectedIds={queueIds}
                                onChange={handleSongToggle}
                            />
                        }
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-white/10 flex-shrink-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white">
                        {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                        Save Playlist
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
