// Time-progress waveform — matches the "Live waveform" style in RoomPage.
// Originally tapped Web Audio's MediaElementAudioSourceNode for real frequency
// bars, but S3 presigned URLs aren't CORS-allowed for analyser reads (the
// browser silently zeroes the analyser output and logs a warning). This version
// is purely deterministic: a seeded PRNG generates a repeatable bar shape per
// song, and bars left of the playback head get the warm-amber→violet gradient
// while upcoming bars stay dim. No Web Audio, no CORS, no zero-output warning.
import { useMemo } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRoomStore } from '@/stores/useRoomStore';
import { cn } from '@/lib/utils';

interface Props {
    bars?:    number;
    className?: string;
}

const seededWaveform = (seed: string, count: number): number[] => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
        h = (h * 16807 + 12345) & 0x7fffffff;
        const base = (h % 1000) / 1000;
        const envelope = 0.3 + 0.7 * Math.sin((i / count) * Math.PI);
        const cluster = 0.5 + 0.5 * Math.sin(i * 0.15 + (h % 100) * 0.01);
        out.push(Math.max(0.08, base * envelope * cluster));
    }
    return out;
};

export const AudioVisualizer = ({ bars: barCount = 64, className }: Props) => {
    const currentTimeMs    = usePlayerStore(s => s.currentTimeMs);
    const currentSongIndex = usePlayerStore(s => s.currentSongIndex);
    const room             = useRoomStore(s => s.room);

    const currentSong = room?.playlist?.[currentSongIndex];
    const duration    = currentSong?.duration ?? 0;
    const progressPct = duration > 0 ? Math.min(100, (currentTimeMs / 1000 / duration) * 100) : 0;

    const seed = currentSong?.title ?? room?.title ?? 'spacic';
    const wave = useMemo(() => seededWaveform(seed, barCount), [seed, barCount]);

    return (
        <div className={cn('relative h-full w-full flex items-end gap-[1.5px]', className)} aria-hidden>
            {wave.map((h, i) => {
                const barPct   = (i / wave.length) * 100;
                const past     = barPct < progressPct;
                const nearHead = Math.abs(barPct - progressPct) < 4;
                return (
                    <span
                        key={i}
                        className={nearHead ? 'animate-pulse' : ''}
                        style={{
                            height: `${h * 100}%`,
                            flex: 1,
                            minWidth: 1,
                            background: past
                                ? `linear-gradient(180deg, oklch(0.88 0.12 ${75 + i * 0.8}), oklch(0.65 0.18 295))`
                                : 'oklch(1 0 0 / 0.12)',
                            borderRadius: 2,
                            transition: 'background 0.3s',
                        }}
                    />
                );
            })}
        </div>
    );
};
