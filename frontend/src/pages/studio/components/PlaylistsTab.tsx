import { useState } from 'react';
import { Loader2, Play, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createPlaylist, deletePlaylist } from '@/lib/playlistService';
import type { SavedPlaylist, Song } from '@/types/types';
import { SongSelector } from './SongSelector';
import { Card, FieldLabel, SectionHead } from './studio-atoms';

interface Props {
    songs: Song[];
    songsLoading: boolean;
    playlists: SavedPlaylist[];
    setPlaylists: React.Dispatch<React.SetStateAction<SavedPlaylist[]>>;
    playlistsLoading: boolean;
    onLoadPlaylist: (p: SavedPlaylist) => void;
}

export const PlaylistsTab = ({
    songs, songsLoading, playlists, setPlaylists, playlistsLoading, onLoadPlaylist,
}: Props) => {
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return toast.error('Playlist name required');
        setCreating(true);
        try {
            const p = await createPlaylist({ name: name.trim(), songs: selectedSongs });
            setPlaylists(prev => [p, ...prev]);
            setName('');
            setSelectedSongs([]);
            setShowForm(false);
            toast.success('Playlist created');
        } catch { toast.error('Failed to create playlist'); }
        finally { setCreating(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this playlist?')) return;
        try {
            await deletePlaylist(id);
            setPlaylists(prev => prev.filter(p => p._id !== id));
            toast.success('Playlist deleted');
        } catch { toast.error('Failed to delete playlist'); }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionHead label="Saved Playlists" sub="Build playlists once, load them into any session" />
                <button onClick={() => setShowForm(p => !p)}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 press">
                    <Plus className="size-3.5" /> New Playlist
                </button>
            </div>

            {showForm && (
                <Card className="space-y-4">
                    <p className="text-[14px] font-semibold text-white">Create Playlist</p>
                    <div>
                        <FieldLabel>Playlist name</FieldLabel>
                        <Input placeholder="e.g. Late Night Jazz" value={name} onChange={e => setName(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                    </div>
                    <div>
                        <FieldLabel>Songs</FieldLabel>
                        {songsLoading ? <Skeleton className="h-48 bg-white/5" /> : (
                            <SongSelector songs={songs} selectedIds={selectedSongs} onChange={setSelectedSongs} />
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowForm(false)} className="h-9 px-4 rounded-xl text-[13px] press hover:bg-white/5"
                            style={{ color: 'var(--fg-3)' }}>Cancel</button>
                        <button onClick={handleCreate} disabled={creating || !name.trim()}
                            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/10 ring-1 ring-white/10 text-[13px] text-white disabled:opacity-50 hover:bg-white/15 press">
                            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                        </button>
                    </div>
                </Card>
            )}

            {playlistsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}
                </div>
            ) : playlists.length === 0 ? (
                <Card className="py-16 text-center">
                    <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No playlists yet — create one above</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {playlists.map(p => (
                        <Card key={p._id} className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-semibold text-white truncate">{p.name}</p>
                                    <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{p.songs.length} songs</p>
                                </div>
                                <button onClick={() => handleDelete(p._id)} className="press hover:text-[oklch(0.72_0.22_20)] transition-colors" style={{ color: 'var(--fg-3)' }}>
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                            <div className="flex -space-x-2">
                                {p.songs.slice(0, 5).map(s => (
                                    <img key={s._id} src={s.imageUrl} alt={s.title} title={s.title}
                                        className="size-8 rounded-lg object-cover ring-1 ring-black/50" />
                                ))}
                                {p.songs.length > 5 && (
                                    <div className="size-8 rounded-lg ring-1 ring-black/50 grid place-items-center mono text-[10px]"
                                        style={{ background: 'var(--ink-1)', color: 'var(--fg-3)' }}>
                                        +{p.songs.length - 5}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => onLoadPlaylist(p)}
                                className="w-full flex items-center justify-center gap-2 h-8 rounded-xl ring-1 ring-white/10 text-[12px] press hover:bg-white/8 transition-colors"
                                style={{ color: 'var(--fg-2)' }}>
                                <Play className="size-3" /> Load into room
                            </button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
