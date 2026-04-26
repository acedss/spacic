import { useRef, useState } from 'react';
import { Sparkles, Vote } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { TipHoldButton } from './TipHoldButton';

interface Props {
    onSendEmoji: (emoji: string) => void;
    onVoteSkip: () => void;
    onDonate: (amount: number) => void;
    onTipHolding: (amount: number) => void;
}

export const ReactionsRow = ({ onSendEmoji, onVoteSkip, onDonate, onTipHolding }: Props) => {
    const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
    const { skipVotes, emojiBursts } = useRoomStore();
    const REACTIONS = ['❤️', '🔥', '✨', '🥲', '🕺', '👏'];
    const burstIdRef = useRef(0);

    const pop = (emoji: string) => {
        const id = ++burstIdRef.current;
        const x = 30 + ((id * 53) % 100) * 0.5;
        setBursts(b => [...b, { id, emoji, x }]);
        setTimeout(() => setBursts(b => b.filter(b2 => b2.id !== id)), 2600);
        onSendEmoji(emoji);
    };

    const allBursts = [
        ...bursts,
        ...emojiBursts.map(b => {
            const idNum = Number(b.id.split('-')[0]);
            return { id: idNum, emoji: b.emoji, x: 20 + ((idNum * 37) % 100) * 0.6 };
        }),
    ];

    return (
        <div className="rounded-2xl ring-1 ring-white/10 glass p-4 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-3.5 text-[oklch(0.88_0.12_75)]" />
                <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Crowd</div>
                <span className="text-[11px]" style={{ color: 'var(--fg-2)' }}>Tap an emoji — everyone sees it float</span>

                <div className="ml-auto flex items-center gap-2">
                    <button onClick={onVoteSkip}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg ring-1 ring-white/15 text-[11px] hover:bg-white/8 press"
                        style={{ color: 'var(--fg-1)' }}>
                        <Vote className="size-3" />
                        Skip {skipVotes.count}/{skipVotes.needed}
                    </button>
                    <TipHoldButton onDonate={onDonate} onHolding={onTipHolding} />
                </div>
            </div>

            <div className="flex items-center gap-2">
                {REACTIONS.map(e => (
                    <button key={e} onClick={() => pop(e)}
                        className="flex-1 h-11 rounded-xl grid place-items-center bg-white/6 hover:bg-white/12 ring-1 ring-white/10 text-[20px] press transition-all hover:scale-105">
                        {e}
                    </button>
                ))}
            </div>

            <div className="absolute inset-0 pointer-events-none">
                {allBursts.map(b => (
                    <span key={b.id} className="absolute text-[28px] animate-float-up"
                        style={{ left: `${b.x}%`, bottom: 10 }}>{b.emoji}</span>
                ))}
            </div>
        </div>
    );
};
