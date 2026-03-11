import { SkipForward, Users, Wifi, WifiOff, Music2, X } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

interface Props {
    onSkip: () => void;
    onClose: () => void;
}

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const RoomPlayer = ({ onSkip, onClose }: Props) => {
    const { room, listenerCount, isCreator } = useRoomStore();
    const { currentSongIndex, currentTimeMs, isSynced } = usePlayerStore();

    const currentSong = room?.playlist?.[currentSongIndex];
    const duration = currentSong?.duration ?? 0;
    const progress = duration > 0 ? (currentTimeMs / 1000 / duration) * 100 : 0;

    if (!room) return null;

    return (
        <div className="flex flex-col bg-zinc-950 rounded-2xl border border-white/5 overflow-hidden h-full">
            {/* Album Art */}
            <div className="relative aspect-square bg-zinc-900 flex-shrink-0">
                {currentSong?.imageUrl ? (
                    <img
                        src={currentSong.imageUrl}
                        alt={currentSong.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="size-16 text-zinc-700" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            </div>

            {/* Song Info */}
            <div className="px-5 pt-4 pb-2">
                <h2 className="text-lg font-bold truncate">
                    {currentSong?.title ?? 'No song playing'}
                </h2>
                <p className="text-zinc-400 text-sm mt-0.5 truncate">
                    {currentSong?.artist ?? room.title}
                </p>
            </div>

            {/* Progress Bar */}
            <div className="px-5 pb-3">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>{formatTime(currentTimeMs / 1000)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Controls Row */}
            <div className="px-5 pb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                    <Users className="size-3.5" />
                    <span>{listenerCount}</span>
                </div>

                {isCreator && (
                    <button
                        onClick={onSkip}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs font-medium"
                    >
                        <SkipForward className="size-3.5" />
                        Skip
                    </button>
                )}

                <div className="flex items-center gap-1.5 text-xs">
                    {isSynced ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                            <Wifi className="size-3.5" />Synced
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-yellow-400">
                            <WifiOff className="size-3.5" />Syncing
                        </span>
                    )}
                </div>
            </div>

            {/* Room Footer */}
            <div className="mt-auto px-5 py-3 border-t border-white/5 flex items-center justify-between">
                <div>
                    <span className="text-xs text-zinc-500 truncate block max-w-32">{room.title}</span>
                    <span className="text-xs text-zinc-700 capitalize">{room.status}</span>
                </div>
                {isCreator && (
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        <X className="size-3.5" />
                        Close Room
                    </button>
                )}
            </div>
        </div>
    );
};
