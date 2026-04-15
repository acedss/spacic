import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Music2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const PlaylistPanel = () => {
    const { room } = useRoomStore();
    const { currentSongIndex } = usePlayerStore();
    const playlist = room?.playlist ?? [];

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-2.5 flex-shrink-0">
                <p className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-semibold">{playlist.length}</span> songs in queue
                </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                {playlist.length === 0 ? (
                    <div className="p-8 text-center">
                        <Music2 className="size-7 text-zinc-700 mx-auto mb-2" />
                        <p className="text-zinc-600 text-xs">No songs in queue</p>
                    </div>
                ) : (
                    <div className="px-2 pb-2 space-y-0.5">
                        {playlist.map((song, idx) => (
                            <div
                                key={`${idx}-${song._id}`}
                                className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors ${
                                    idx === currentSongIndex
                                        ? 'bg-white/8 border border-violet-500/30'
                                        : 'hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={song.imageUrl}
                                        alt={song.title}
                                        className="w-8 h-8 rounded-lg object-cover"
                                    />
                                    {idx === currentSongIndex && (
                                        <div className="absolute inset-0 flex items-end justify-center pb-0.5 gap-px rounded-lg bg-black/40">
                                            <div className="w-px h-2 bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-px h-3 bg-violet-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                                            <div className="w-px h-1.5 bg-violet-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${idx === currentSongIndex ? 'text-violet-300' : 'text-zinc-200'}`}>
                                        {song.title}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 truncate">{song.artist}</p>
                                </div>
                                <span className="text-[10px] text-zinc-700 flex-shrink-0 w-4 text-right">
                                    {idx + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
