import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getSongs, upsertRoom } from '@/lib/roomService';
import type { Song } from '@/types/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const CreateRoomModal = ({ isOpen, onClose }: Props) => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [streamGoalCoins, setStreamGoalCoins] = useState('');
    const [songs, setSongs] = useState<Song[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch available songs once on open
    useEffect(() => {
        if (!isOpen) return;
        getSongs().then(setSongs).catch(() => setError('Failed to load songs'));
    }, [isOpen]);

    const toggleSong = (id: string) =>
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return setError('Room title is required');
        if (selectedIds.length === 0) return setError('Pick at least one song');
        try {
            setIsSubmitting(true);
            setError(null);
            const streamGoal = streamGoalCoins ? Math.max(0, parseInt(streamGoalCoins, 10)) : 0;
            const room = await upsertRoom({ title: title.trim(), playlistIds: selectedIds, streamGoal });
            onClose();
            navigate(`/rooms/${room._id}`);
        } catch {
            setError('Failed to create room. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Create a Room</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1.5">Room name</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Late Night Vibes"
                            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                        />
                    </div>

                    {/* Stream goal (optional) */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1.5">
                            Stream goal <span className="text-zinc-600">(optional, in coins)</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={streamGoalCoins}
                            onChange={(e) => setStreamGoalCoins(e.target.value)}
                            placeholder="e.g. 1000"
                            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                        />
                        <p className="text-xs text-zinc-600 mt-1">Listeners can donate coins toward this goal.</p>
                    </div>

                    {/* Song selection */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm text-zinc-400">Playlist</label>
                            <span className="text-xs text-purple-400">{selectedIds.length} selected</span>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {songs.length === 0 ? (
                                <p className="text-zinc-500 text-sm py-4 text-center">Loading songs...</p>
                            ) : (
                                songs.map((song) => {
                                    const selected = selectedIds.includes(song._id);
                                    return (
                                        <button
                                            key={song._id}
                                            type="button"
                                            onClick={() => toggleSong(song._id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left
                                                ${selected ? 'bg-purple-600/20 ring-1 ring-purple-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                                        >
                                            <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                                                <p className="text-zinc-400 text-xs truncate">{song.artist}</p>
                                            </div>
                                            {selected && <div className="size-2 rounded-full bg-purple-400 shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Room'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateRoomModal;
