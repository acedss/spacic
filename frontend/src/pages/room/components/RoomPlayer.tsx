import { SkipForward, Users, Wifi, WifiOff, Music2, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { cn } from '@/lib/utils';

interface Props {
    onSkip: () => void;
    onClose: () => void;
    onReact: (reaction: 'like' | 'dislike') => void;
}

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const RoomPlayer = ({ onSkip, onClose, onReact }: Props) => {
    const { room, listenerCount, isCreator, reactions } = useRoomStore();
    const { currentSongIndex, currentTimeMs, isSynced } = usePlayerStore();

    const currentSong = room?.playlist?.[currentSongIndex];
    const duration = currentSong?.duration ?? 0;
    const progress = duration > 0 ? Math.min(100, (currentTimeMs / 1000 / duration) * 100) : 0;

    if (!room) return null;

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden ring-1 ring-white/10"
             style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>

            {/* Album art */}
            <div className="relative aspect-square overflow-hidden">
                {currentSong?.imageUrl ? (
                    <img src={currentSong.imageUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--ink-2)' }}>
                        <Music2 className="size-14 opacity-20 text-white" />
                    </div>
                )}
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 20%, transparent 40%, oklch(0.1 0.015 285 / 0.6))' }} />

                {/* Rotating disc ring */}
                <div className="absolute inset-4 rounded-full ring-1 ring-white/10 pointer-events-none"
                     style={{ animation: 'orbit-slow 40s linear infinite' }}>
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[oklch(0.88_0.12_75)]" />
                </div>

                {/* Listener count chip */}
                <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-black/50 text-white/80 ring-1 ring-white/15">
                        <Users className="size-3" /> {listenerCount}
                    </span>
                </div>
            </div>

            {/* Song info + controls */}
            <div className="px-5 pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2 select-none">
                    <span className="mono text-[9px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>Now playing</span>
                    {/* Sync pill moved up next to the label — saves a row */}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] mono">
                        {isSynced ? (
                            <span className="flex items-center gap-1 text-[oklch(0.74_0.14_160)]">
                                <Wifi className="size-3" /> Synced
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[oklch(0.88_0.12_75)]">
                                <WifiOff className="size-3" /> Syncing…
                            </span>
                        )}
                    </span>
                </div>
                <h2 className="serif text-[26px] leading-[1.05] text-white truncate">
                    {currentSong?.title ?? 'No song playing'}
                </h2>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--fg-2)' }}>
                    {currentSong?.artist ?? room.title}
                </p>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000"
                             style={{ width: `${progress}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                            {formatTime(currentTimeMs / 1000)}
                        </span>
                        <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Actions row — reactions + creator controls inline */}
                <div className="mt-3 flex items-center gap-1.5">
                    <button onClick={() => onReact('like')}
                        className={cn(
                            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg ring-1 text-[11px] press transition-colors',
                            reactions.likes > 0
                                ? 'ring-[oklch(0.74_0.14_160_/_0.4)] bg-[oklch(0.74_0.14_160_/_0.12)] text-[oklch(0.82_0.14_160)]'
                                : 'ring-white/10 bg-white/4 hover:bg-white/8',
                        )}
                        style={reactions.likes > 0 ? undefined : { color: 'var(--fg-2)' }}
                        aria-label="Like this song">
                        <ThumbsUp className="size-3.5" />
                        <span className="tabular-nums">{reactions.likes}</span>
                    </button>
                    <button onClick={() => onReact('dislike')}
                        className={cn(
                            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg ring-1 text-[11px] press transition-colors',
                            reactions.dislikes > 0
                                ? 'ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.08)] text-[oklch(0.82_0.17_20)]'
                                : 'ring-white/10 bg-white/4 hover:bg-white/8',
                        )}
                        style={reactions.dislikes > 0 ? undefined : { color: 'var(--fg-2)' }}
                        aria-label="Dislike this song">
                        <ThumbsDown className="size-3.5" />
                        <span className="tabular-nums">{reactions.dislikes}</span>
                    </button>

                    {isCreator && (
                        <>
                            <span className="flex-1" />
                            <button onClick={onSkip}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg ring-1 ring-white/12 text-[11px] hover:bg-white/8 press transition-colors"
                                style={{ color: 'var(--fg-1)' }}>
                                <SkipForward className="size-3.5" /> Skip
                            </button>
                            <button onClick={onClose}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.1)] text-[oklch(0.82_0.17_20)] text-[11px] press hover:bg-[oklch(0.72_0.22_20_/_0.2)]">
                                <X className="size-3.5" /> End
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
