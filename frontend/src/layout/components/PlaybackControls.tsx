import { Play, Pause, Music2, Wifi, WifiOff } from 'lucide-react';
import { useAudioRef } from '@/providers/AudioProvider';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlaybackControls = () => {
    const audioRef = useAudioRef();
    const { room, isCreator } = useRoomStore();
    const { isAdmin } = useAuthStore();
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, setPlaying } = usePlayerStore();
    const canSeek = isCreator || isAdmin;

    if (!room) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-700 text-xs">
                Join a room to start listening
            </div>
        );
    }

    const currentSong = room.playlist[currentSongIndex];
    // Prefer the real duration from the audio element (accurate); fall back to DB value
    const audioDuration = audioRef.current?.duration;
    const duration = (audioDuration && isFinite(audioDuration)) ? audioDuration : (currentSong?.duration ?? 0);
    const progress = duration > 0 ? (currentTimeMs / 1000 / duration) * 100 : 0;

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(() => {});
        }

        // Only creator/admin updates the store immediately (optimistic).
        // The onPlay/onPause callback then emits room:resume/room:pause,
        // and the server broadcasts room:sync to all clients.
        // For listeners, audio toggles locally — next room:sync re-syncs.
        if (canSeek) {
            setPlaying(!isPlaying);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLElement>) => {
        console.log('[handleSeek] canSeek:', canSeek, '| isCreator:', isCreator, '| isAdmin:', isAdmin, '| duration:', duration);
        if (!canSeek || !audioRef.current || duration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = Math.max(0, Math.min(ratio * duration, duration));
    };

    return (
        <div className="flex items-center h-full gap-6 px-2">
            {/* Song info */}
            <div className="flex items-center gap-3 w-52 min-w-0 flex-shrink-0">
                {currentSong?.imageUrl ? (
                    <img
                        src={currentSong.imageUrl}
                        alt={currentSong.title}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <Music2 className="size-4 text-zinc-600" />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentSong?.title ?? '—'}</p>
                    <p className="text-xs text-zinc-400 truncate">{currentSong?.artist ?? room.title}</p>
                </div>
            </div>

            {/* Center: play button + progress */}
            <div className="flex flex-col items-center flex-1 gap-1 min-w-0">
                <button
                    onClick={togglePlay}
                    className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors flex-shrink-0"
                >
                    {isPlaying
                        ? <Pause className="size-3.5 fill-black" />
                        : <Play className="size-3.5 fill-black ml-0.5" />
                    }
                </button>
                <div className="flex items-center gap-2 w-full max-w-sm">
                    <span className="text-xs text-zinc-500 w-8 text-right tabular-nums flex-shrink-0">
                        {formatTime(currentTimeMs / 1000)}
                    </span>
                    <Progress
                        value={Math.min(progress, 100)}
                        onClick={handleSeek}
                        className={cn(
                            'h-1 bg-white/10 [&>[data-slot=progress-indicator]]:bg-white',
                            canSeek && 'cursor-pointer hover:h-1.5 transition-all'
                        )}
                    />
                    <span className="text-xs text-zinc-500 w-8 tabular-nums flex-shrink-0">
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Right: sync status */}
            <div className="w-24 flex justify-end flex-shrink-0">
                {isSynced ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <Wifi className="size-3" />Synced
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                        <WifiOff className="size-3" />Syncing...
                    </span>
                )}
            </div>
        </div>
    );
};
