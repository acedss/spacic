import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Music2 } from 'lucide-react';

export const PlaylistPanel = () => {
    const { room } = useRoomStore();
    const { currentSongIndex } = usePlayerStore();
    const playlist = room?.playlist ?? [];

    return (
        <div className="bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-zinc-300">
                    Queue <span className="text-zinc-500 font-normal">({playlist.length})</span>
                </h3>
            </div>

            <div className="overflow-y-auto max-h-56">
                {playlist.length === 0 ? (
                    <div className="p-6 text-center">
                        <Music2 className="size-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-500 text-xs">No songs in queue</p>
                    </div>
                ) : (
                    playlist.map((song, idx) => (
                        <div
                            key={song._id}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                idx === currentSongIndex
                                    ? 'bg-white/5 border-l-2 border-emerald-500'
                                    : 'hover:bg-white/5 border-l-2 border-transparent'
                            }`}
                        >
                            <img
                                src={song.imageUrl}
                                alt={song.title}
                                className="w-9 h-9 rounded object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${idx === currentSongIndex ? 'text-emerald-400' : 'text-white'}`}>
                                    {song.title}
                                </p>
                                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                            </div>
                            {idx === currentSongIndex && (
                                <div className="flex gap-0.5 items-end h-4 flex-shrink-0">
                                    <div className="w-0.5 h-3 bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-0.5 h-4 bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-0.5 h-2 bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
