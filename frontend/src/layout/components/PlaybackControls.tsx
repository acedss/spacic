import { Play, Pause, Heart, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAudioRef } from '@/providers/AudioProvider';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActiveRoomStore } from '@/stores/useActiveRoomStore';
import { cn } from '@/lib/utils';

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlaybackControls = () => {
    const audioRef = useAudioRef();
    const { room, isCreator, listenerCount } = useRoomStore();
    const { isAdmin } = useAuthStore();
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, setPlaying } = usePlayerStore();
    const { activeRoomId } = useActiveRoomStore();
    const location = useLocation();
    const canSeek = isCreator || isAdmin;

    // True when the user is in a room but browsing a different page
    const isBackgrounded = !!activeRoomId && location.pathname !== `/rooms/${activeRoomId}`;

    if (!room) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Join a room to start listening
            </div>
        );
    }

    const currentSong = room.playlist[currentSongIndex];
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
        if (canSeek) setPlaying(!isPlaying);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canSeek || !audioRef.current || duration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = Math.max(0, Math.min(ratio * duration, duration));
    };

    return (
        <div className="flex items-center h-full gap-4 px-8">

            {/* Left: Song info */}
            <div className="flex items-center gap-4 w-1/4">
                {currentSong?.imageUrl ? (
                    <img
                        src={currentSong.imageUrl}
                        alt={currentSong.title}
                        className="size-14 rounded-xl object-cover flex-shrink-0 shadow-lg"
                    />
                ) : (
                    <div className="size-14 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-500 text-xl">♪</span>
                    </div>
                )}
                <div className="min-w-0">
                    <h5 className="text-slate-100 font-bold text-sm truncate">{currentSong?.title ?? '—'}</h5>
                    <p className="text-slate-400 text-xs truncate">{currentSong?.artist ?? room.title}</p>
                </div>
                <button className="text-slate-400 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                    <Heart className="size-5" />
                </button>
            </div>

            {/* Center: Controls + Progress */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto gap-2">
                <div className="flex items-center gap-8">
                    <button
                        onClick={togglePlay}
                        className="size-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform flex-shrink-0"
                    >
                        {isPlaying
                            ? <Pause className="size-5 fill-black stroke-none" />
                            : <Play className="size-5 fill-black stroke-none ml-0.5" />
                        }
                    </button>
                </div>

                {/* Progress bar */}
                <div className="w-full flex items-center gap-3">
                    <span className="text-[10px] font-medium text-slate-500 w-8 text-right tabular-nums flex-shrink-0">
                        {formatTime(currentTimeMs / 1000)}
                    </span>
                    <div
                        className={cn(
                            'flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden group',
                            canSeek && 'cursor-pointer'
                        )}
                        onClick={handleSeek}
                    >
                        <div
                            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                        {canSeek && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 size-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
                                style={{ left: `${Math.min(progress, 100)}%` }}
                            />
                        )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 w-8 tabular-nums flex-shrink-0">
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Right: Volume + extras + Return to Room pill */}
            <div className="w-1/4 flex items-center justify-end gap-4">
                <div className="flex items-center gap-2 w-24">
                    <Volume2 className="text-slate-400 size-4 flex-shrink-0" />
                    <div className="flex-1 h-1 bg-white/10 rounded-full">
                        <div className="h-full w-4/5 bg-slate-300 rounded-full" />
                    </div>
                </div>
                {isSynced ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                        <Wifi className="size-3" />Synced
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] text-yellow-400 flex-shrink-0">
                        <WifiOff className="size-3" />Syncing
                    </span>
                )}

                {isBackgrounded && (
                    <Link
                        to={`/rooms/${activeRoomId}`}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0"
                    >
                        <span className="size-1.5 bg-red-400 rounded-full animate-pulse" />
                        {room?.title ?? 'Live Room'}
                        {listenerCount > 0 && (
                            <span className="text-red-400/60">• {listenerCount}</span>
                        )}
                    </Link>
                )}
            </div>
        </div>
    );
};
