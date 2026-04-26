import { useMemo } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import type { RoomInfo } from '@/types/types';

const seededWaveform = (seed: string, count: number): number[] => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
        h = (h * 16807 + 12345) & 0x7fffffff;
        const base = (h % 1000) / 1000;
        const envelope = 0.3 + 0.7 * Math.sin((i / count) * Math.PI);
        const cluster = 0.5 + 0.5 * Math.sin(i * 0.15 + (h % 100) * 0.01);
        bars.push(Math.max(0.08, base * envelope * cluster));
    }
    return bars;
};

export const NowMoment = ({ room }: { room: RoomInfo }) => {
    const creator = (room as any).creatorId as { fullName?: string; imageUrl?: string } | undefined;
    const pinnedMessage = useRoomStore(s => s.pinnedMessage);
    const currentTimeMs = usePlayerStore(s => s.currentTimeMs);
    const currentSongIndex = usePlayerStore(s => s.currentSongIndex);
    const currentSong = room.playlist[currentSongIndex];
    const duration = currentSong?.duration ?? 0;
    const progressPct = duration > 0 ? Math.min(100, (currentTimeMs / 1000 / duration) * 100) : 0;
    const waveBars = useMemo(
        () => seededWaveform(currentSong?.title ?? room.title ?? 'spacic', 80),
        [currentSong?.title, room.title]
    );

    return (
        <div className="rounded-2xl ring-1 ring-white/10 glass overflow-hidden">
            {pinnedMessage ? (
                <div className="p-5 flex items-start gap-4">
                    {creator?.imageUrl && (
                        <img src={creator.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20 shrink-0" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-white font-medium">{pinnedMessage.userName || creator?.fullName || 'Host'}</span>
                            <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-0.5 bg-[oklch(0.68_0.21_295_/_0.15)] text-[oklch(0.82_0.14_295)] ring-1 ring-[oklch(0.68_0.21_295_/_0.3)]">
                                Pinned
                            </span>
                            <span className="mono text-[10px] uppercase tracking-wider ml-auto" style={{ color: 'var(--fg-3)' }}>
                                {new Date(pinnedMessage.pinnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="serif italic text-[20px] text-white leading-snug mt-2">
                            "{pinnedMessage.message}"
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-5 flex items-start gap-4">
                    {creator?.imageUrl && (
                        <img src={creator.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20 shrink-0" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] text-white font-medium">{creator?.fullName ?? 'Host'}</span>
                            <span className="mono text-[10px] uppercase tracking-wider ml-auto" style={{ color: 'var(--fg-3)' }}>No pin yet</span>
                        </div>
                        <p className="text-[13px] mt-2" style={{ color: 'var(--fg-3)' }}>
                            The creator hasn't pinned a message yet. Hover a chat message and click 📌 to pin it.
                        </p>
                    </div>
                </div>
            )}

            <div className="px-5 pb-4 pt-1 relative border-t hair" style={{ background: 'var(--ink-2)' }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Live waveform</div>
                    <div className="mono text-[11px] tabular-nums" style={{ color: 'var(--fg-2)' }}>−12 LUFS</div>
                </div>
                <div className="relative h-14 flex items-end gap-[1.5px]">
                    {waveBars.map((h, i) => {
                        const barPct = (i / waveBars.length) * 100;
                        const past = barPct < progressPct;
                        const nearHead = Math.abs(barPct - progressPct) < 4;
                        return (
                            <span key={i} className={nearHead ? 'animate-pulse' : ''} style={{
                                height: `${h * 100}%`, flex: 1, minWidth: 1,
                                background: past
                                    ? `linear-gradient(180deg, oklch(0.88 0.12 ${75 + i * 0.8}), oklch(0.65 0.18 295))`
                                    : 'oklch(1 0 0 / 0.12)',
                                borderRadius: 2,
                                transition: 'background 0.3s',
                            }} />
                        );
                    })}
                    <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${progressPct}%` }}>
                        <div className="w-px h-full bg-white/80" />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 mono text-[9px] text-white bg-black/70 px-1.5 py-0.5 rounded ring-1 ring-white/20">now</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
