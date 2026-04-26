import { SkipForward } from 'lucide-react';
import type { RoomInfo } from '@/types/types';

interface Props {
    room: RoomInfo;
    connected: boolean;
    onEdit: () => void;
    onSkip: () => void;
}

export const LivePlaylistColumn = ({ room, connected, onEdit, onSkip }: Props) => {
    const currentSong = room.playlist[room.playback.currentSongIndex];

    return (
        <div className="flex flex-col p-5 gap-4 overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playlist</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEdit}
                        className="text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                        Edit
                    </button>
                    <button
                        onClick={onSkip}
                        disabled={!connected}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                        <SkipForward className="size-3.5" /> Skip
                    </button>
                </div>
            </div>

            {currentSong && (
                <div className="flex items-center gap-3 bg-white/8 border border-white/15 rounded-xl px-3 py-3 flex-shrink-0">
                    <div className="relative flex-shrink-0">
                        <img src={currentSong.imageUrl} alt={currentSong.title} className="size-12 rounded-lg object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="size-2.5 rounded-full bg-white/80 animate-pulse" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
                        <p className="text-xs text-zinc-400 truncate">{currentSong.artist}</p>
                        <p className="text-[10px] text-violet-400 mt-0.5">Now playing</p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Up next</p>
                {room.playlist
                    .slice(room.playback.currentSongIndex + 1, room.playback.currentSongIndex + 10)
                    .map((song, i) => (
                        <div
                            key={`upcoming-${room.playback.currentSongIndex + 1 + i}-${song._id}`}
                            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                            <span className="text-[10px] text-zinc-600 w-4 text-right flex-shrink-0">
                                {room.playback.currentSongIndex + 2 + i}
                            </span>
                            <img src={song.imageUrl} alt={song.title} className="size-8 rounded-md object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-zinc-300 group-hover:text-white truncate transition-colors">{song.title}</p>
                                <p className="text-[10px] text-zinc-600 truncate">{song.artist}</p>
                            </div>
                        </div>
                    ))}
                {room.playlist.length <= room.playback.currentSongIndex + 1 && (
                    <p className="text-xs text-zinc-600 px-2 py-4">End of playlist — random next</p>
                )}
            </div>
        </div>
    );
};
