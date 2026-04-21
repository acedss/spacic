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
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, setPlaying, listenerLocalPaused, setListenerLocalPaused } = usePlayerStore();
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
            <div className="flex items-center justify-center h-full">
                <span className="mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                    Join a room to start listening
                </span>
            </div>
        );
    }

    const currentSong = room.playlist[currentSongIndex];
    const audioDuration = audioRef.current?.duration;
    const duration = (audioDuration && isFinite(audioDuration)) ? audioDuration : (currentSong?.duration ?? 0);
    const progress = duration > 0 ? (currentTimeMs / 1000 / duration) * 100 : 0;

    // Effective playing state: room says playing, but listener may have locally paused
    const effectivelyPlaying = canSeek ? isPlaying : (isPlaying && !listenerLocalPaused);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (canSeek) {
            // Creator/admin: toggle room playback
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play().catch(() => {});
            setPlaying(!isPlaying);
        } else {
            // Listener: toggle local pause without affecting room state
            if (listenerLocalPaused) {
                setListenerLocalPaused(false);
                audioRef.current.play().catch(() => {});
            } else {
                setListenerLocalPaused(true);
                audioRef.current.pause();
            }
        }
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
        <div className="flex flex-col justify-center h-full px-5 md:px-8 gap-2">

            {/* Row 1: thumbnail + info + controls */}
            <div className="flex items-center gap-3">

                {/* Thumbnail */}
                {currentSong?.imageUrl ? (
                    <img
                        src={currentSong.imageUrl}
                        alt={currentSong.title}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex-shrink-0 grid place-items-center"
                        style={{ background: 'var(--ink-2)' }}>
                        <span className="text-white/30 text-lg">♪</span>
                    </div>
                )}

                {/* Song info */}
                <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium truncate leading-tight">
                        {currentSong?.title ?? '—'}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--fg-3)' }}>
                        {currentSong?.artist ?? room.title}
                    </p>
                </div>

                {/* Favorite */}
                <button
                    onClick={handleFavorite}
                    className={cn(
                        'hidden sm:block transition-colors flex-shrink-0 press',
                        isFavorited ? 'text-[oklch(0.82_0.17_20)]' : 'hover:text-white'
                    )}
                    style={{ color: isFavorited ? undefined : 'var(--fg-3)' }}
                >
                    <Heart className={cn('size-4', isFavorited && 'fill-[oklch(0.82_0.17_20)]')} />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white text-[var(--ink-0)] grid place-items-center press flex-shrink-0"
                >
                    {effectivelyPlaying
                        ? <Pause className="size-4 fill-[var(--ink-0)] stroke-none" />
                        : <Play  className="size-4 fill-[var(--ink-0)] stroke-none ml-0.5" />
                    }
                </button>

                {/* Volume */}
                <div className="hidden md:flex items-center gap-2 w-28 flex-shrink-0">
                    <button
                        onClick={() => setVolume(v => v === 0 ? 80 : 0)}
                        className="press transition-colors flex-shrink-0"
                        style={{ color: 'var(--fg-3)' }}
                    >
                        {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <Slider
                        min={0} max={100} step={1} value={[volume]}
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
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium press flex-shrink-0 bg-[oklch(0.72_0.22_20_/_0.12)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)]"
                    >
                        <span className="live-dot" style={{ width: 5, height: 5 }} />
                        <span className="hidden md:inline">{room?.title ?? 'Live Room'}</span>
                        {listenerCount > 0 && (
                            <span className="opacity-60 hidden md:inline">· {listenerCount}</span>
                        )}
                    </Link>
                )}
            </div>

            {/* Row 2: seek bar */}
            <div className="flex items-center gap-3">
                <span className="mono text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--fg-3)' }}>
                    {formatTime(displayTime)}
                </span>
                <div className="flex-1 relative">
                    <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(isSeeking.current ? (seekPreview! / duration * 100) : progress, 100)}%`,
                                background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))',
                            }}
                        />
                    </div>
                    {canSeek && (
                        <Slider
                            min={0} max={100} step={0.01}
                            value={[isSeeking.current ? (seekPreview! / duration * 100) : Math.min(progress, 100)]}
                            onValueChange={handleSeekChange}
                            onValueCommit={handleSeekCommit}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    )}
                </div>
                <span className="mono text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--fg-3)' }}>
                    {formatTime(duration)}
                </span>
            </div>

            {/* Mobile: return-to-room pill */}
            {isBackgrounded && (
                <Link
                    to={`/rooms/${activeRoomId}`}
                    className="sm:hidden w-full flex items-center justify-center gap-2 py-1 rounded-lg text-[12px] font-medium bg-[oklch(0.72_0.22_20_/_0.12)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.3)]"
                >
                    <span className="live-dot" style={{ width: 5, height: 5 }} />
                    Return to {room?.title ?? 'Live Room'}
                </Link>
            )}
        </div>
    );
};
