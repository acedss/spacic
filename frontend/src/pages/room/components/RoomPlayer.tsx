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
            <div className="p-5">
                <div className="mono text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>Now playing</div>
                <h2 className="serif text-[28px] leading-[1.05] text-white truncate">
                    {currentSong?.title ?? 'No song playing'}
                </h2>
                <p className="text-[13px] mt-0.5 truncate" style={{ color: 'var(--fg-2)' }}>
                    {currentSong?.artist ?? room.title}
                </p>

                {/* Progress bar */}
                <div className="mt-5">
                    <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000"
                             style={{ width: `${progress}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                            {formatTime(currentTimeMs / 1000)}
                        </span>
                        <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Controls row */}
                <div className="mt-4 flex items-center justify-between">
                    {/* Sync status */}
                    <div className="flex items-center gap-1.5 text-[11px] mono">
                        {isSynced ? (
                            <span className="flex items-center gap-1 text-[oklch(0.74_0.14_160)]">
                                <Wifi className="size-3.5" /> Synced
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[oklch(0.88_0.12_75)]">
                                <WifiOff className="size-3.5" /> Syncing…
                            </span>
                        )}
                    </div>

                    {isCreator && (
                        <button onClick={onSkip}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/8 press transition-colors"
                            style={{ color: 'var(--fg-1)' }}>
                            <SkipForward className="size-3.5" /> Skip
                        </button>
                    )}

                    {isCreator && (
                        <button onClick={onClose}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.1)] text-[oklch(0.82_0.17_20)] text-[12px] press hover:bg-[oklch(0.72_0.22_20_/_0.2)]">
                            <X className="size-3.5" /> Go offline
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
