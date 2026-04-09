import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Heart, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useAudioRef } from '@/providers/AudioProvider';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActiveRoomStore } from '@/stores/useActiveRoomStore';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toggleFavorite, getFavoriteStatus } from '@/lib/roomService';
import { toast } from 'sonner';

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlaybackControls = () => {
    const audioRef = useAudioRef();
    const { room, isCreator, listenerCount } = useRoomStore();
    const { isAdmin } = useAuthStore();
    const { userId } = useAuth();
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, setPlaying } = usePlayerStore();
    const { activeRoomId } = useActiveRoomStore();
    const location = useLocation();
    const canSeek = isCreator || isAdmin;

    const [volume, setVolume] = useState(80);
    const [isFavorited, setIsFavorited] = useState(false);
    const isSeeking = useRef(false);
    const [seekPreview, setSeekPreview] = useState<number | null>(null);

    const isBackgrounded = !!activeRoomId && location.pathname !== `/rooms/${activeRoomId}`;

    // Sync volume to audio element
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume / 100;
    }, [audioRef, volume]);

    // Load favorite status when room changes
    useEffect(() => {
        if (!userId || !room?._id) return;
        getFavoriteStatus(room._id)
            .then(fav => setIsFavorited(fav))
            .catch(() => {});
    }, [userId, room?._id]);

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
        if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play().catch(() => {}); }
        if (canSeek) setPlaying(!isPlaying);
    };

    const handleFavorite = async () => {
        if (!userId) return;
        try {
            const { favorited } = await toggleFavorite(room._id);
            setIsFavorited(favorited);
            toast.success(favorited ? 'Added to favorites' : 'Removed from favorites');
        } catch {
            toast.error('Could not update favorites');
        }
    };

    // Seek via Slider — value is 0–100
    const handleSeekChange = (vals: number[]) => {
        if (!canSeek || !audioRef.current || duration === 0) return;
        isSeeking.current = true;
        const ratio = vals[0] / 100;
        setSeekPreview(ratio * duration);
        audioRef.current.currentTime = ratio * duration;
    };
    const handleSeekCommit = () => {
        isSeeking.current = false;
        setSeekPreview(null);
    };

    const displayTime = seekPreview !== null ? seekPreview : currentTimeMs / 1000;

    const SyncBadge = () => isSynced ? (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
            <Wifi className="size-3" /><span className="hidden sm:inline">Synced</span>
        </span>
    ) : (
        <span className="flex items-center gap-1 text-[10px] text-yellow-400 flex-shrink-0">
            <WifiOff className="size-3" /><span className="hidden sm:inline">Syncing</span>
        </span>
    );

    return (
        <div className="flex flex-col justify-center h-full px-4 md:px-8 gap-1.5">

            {/* Row 1: thumbnail + song info + controls */}
            <div className="flex items-center gap-3">

                {/* Thumbnail */}
                {currentSong?.imageUrl ? (
                    <img
                        src={currentSong.imageUrl}
                        alt={currentSong.title}
                        className="size-10 md:size-14 rounded-xl object-cover flex-shrink-0 shadow-lg"
                    />
                ) : (
                    <div className="size-10 md:size-14 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-500 text-lg">♪</span>
                    </div>
                )}

                {/* Song info */}
                <div className="flex-1 min-w-0">
                    <p className="text-slate-100 font-bold text-xs sm:text-sm truncate leading-tight">
                        {currentSong?.title ?? '—'}
                    </p>
                    <p className="text-slate-400 text-[10px] sm:text-xs truncate">
                        {currentSong?.artist ?? room.title}
                    </p>
                </div>

                {/* Favorite */}
                <button
                    onClick={handleFavorite}
                    className={cn(
                        'hidden sm:block transition-colors flex-shrink-0',
                        isFavorited ? 'text-red-400' : 'text-slate-400 hover:text-red-400'
                    )}
                >
                    <Heart className={cn('size-4', isFavorited && 'fill-red-400')} />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="size-10 md:size-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
                >
                    {isPlaying
                        ? <Pause className="size-4 md:size-5 fill-black stroke-none" />
                        : <Play  className="size-4 md:size-5 fill-black stroke-none ml-0.5" />
                    }
                </button>

                {/* Volume — desktop only */}
                <div className="hidden md:flex items-center gap-2 w-28 flex-shrink-0">
                    <button
                        onClick={() => setVolume(v => v === 0 ? 80 : 0)}
                        className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                    >
                        {volume === 0
                            ? <VolumeX className="size-4" />
                            : <Volume2 className="size-4" />
                        }
                    </button>
                    <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[volume]}
                        onValueChange={(vals) => setVolume(vals[0])}
                        className="flex-1"
                    />
                </div>

                {/* Sync badge */}
                <SyncBadge />

                {/* Return-to-room pill */}
                {isBackgrounded && (
                    <Link
                        to={`/rooms/${activeRoomId}`}
                        className="hidden sm:flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-full text-xs font-bold transition-colors flex-shrink-0"
                    >
                        <span className="size-1.5 bg-red-400 rounded-full animate-pulse" />
                        <span className="hidden md:inline">{room?.title ?? 'Live Room'}</span>
                        <span className="md:hidden">Live</span>
                        {listenerCount > 0 && (
                            <span className="text-red-400/60 hidden md:inline">· {listenerCount}</span>
                        )}
                    </Link>
                )}
            </div>

            {/* Row 2: seek bar */}
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-medium text-slate-500 w-7 text-right tabular-nums flex-shrink-0">
                    {formatTime(displayTime)}
                </span>
                <Slider
                    min={0}
                    max={100}
                    step={0.01}
                    value={[isSeeking.current ? (seekPreview! / duration * 100) : Math.min(progress, 100)]}
                    onValueChange={handleSeekChange}
                    onValueCommit={handleSeekCommit}
                    disabled={!canSeek}
                    className={cn('flex-1', !canSeek && 'opacity-100 [&_[data-slot=slider-thumb]]:hidden')}
                />
                <span className="text-[9px] font-medium text-slate-500 w-7 tabular-nums flex-shrink-0">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Mobile: return-to-room pill */}
            {isBackgrounded && (
                <Link
                    to={`/rooms/${activeRoomId}`}
                    className="sm:hidden w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 py-1 rounded-lg text-xs font-bold"
                >
                    <span className="size-1.5 bg-red-400 rounded-full animate-pulse" />
                    Return to {room?.title ?? 'Live Room'}
                </Link>
            )}
        </div>
    );
};
