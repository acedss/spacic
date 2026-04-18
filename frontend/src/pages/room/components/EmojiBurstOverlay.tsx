import { useEffect, useState } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';
import type { EmojiBurst } from '@/stores/useRoomStore';

const EMOJI_PRESETS = ['🔥', '❤️', '👏', '😂', '🎵', '💀'];

interface Props {
    onSendEmoji: (emoji: string) => void;
}

export const EmojiBurstOverlay = ({ onSendEmoji }: Props) => {
    const emojiBursts = useRoomStore((s) => s.emojiBursts);
    const [visible, setVisible] = useState<(EmojiBurst & { x: number })[]>([]);

    useEffect(() => {
        if (emojiBursts.length === 0) return;
        const latest = emojiBursts[emojiBursts.length - 1];
        const withPos = { ...latest, x: 10 + Math.random() * 80 };
        setVisible((prev) => [...prev.slice(-14), withPos]);
        const timer = setTimeout(() => {
            setVisible((prev) => prev.filter((b) => b.id !== latest.id));
        }, 2500);
        return () => clearTimeout(timer);
    }, [emojiBursts]);

    return (
        <>
            {/* Floating emojis */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {visible.map((burst) => (
                    <span
                        key={burst.id}
                        className="absolute text-2xl animate-float-up"
                        style={{ left: `${burst.x}%`, bottom: '10%' }}
                    >
                        {burst.emoji}
                    </span>
                ))}
            </div>

            {/* Emoji picker bar */}
            <div className="flex items-center gap-1">
                {EMOJI_PRESETS.map((e) => (
                    <button
                        key={e}
                        onClick={() => onSendEmoji(e)}
                        className="text-lg hover:scale-125 transition-transform px-0.5"
                    >
                        {e}
                    </button>
                ))}
            </div>
        </>
    );
};
