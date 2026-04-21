import { useRef, useState, useCallback, useMemo } from 'react';
import { CoolMode } from '@/components/ui/cool-mode';
import { cn } from '@/lib/utils';

const TICK_MS = 300;
const COINS_STEP = 10;
const MAX_COINS = 99_999; // effectively unlimited

interface Props {
    onDonate: (amount: number) => void;
    onHolding?: (amount: number) => void;
    disabled?: boolean;
}

export const TipHoldButton = ({ onDonate, onHolding, disabled }: Props) => {
    const [holding, setHolding] = useState(false);
    const [accum, setAccum] = useState(0);
    const accumRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stop = useCallback(() => {
        if (!intervalRef.current) return;
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setHolding(false);
        if (accumRef.current > 0) onDonate(accumRef.current);
        accumRef.current = 0;
        setAccum(0);
    }, [onDonate]);

    const start = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled || intervalRef.current) return;
        // Capture pointer so pointerup fires here even if mouse moves off-button
        e.currentTarget.setPointerCapture(e.pointerId);
        setHolding(true);
        intervalRef.current = setInterval(() => {
            if (accumRef.current >= MAX_COINS) return;
            accumRef.current = Math.min(accumRef.current + COINS_STEP, MAX_COINS);
            setAccum(accumRef.current);
            onHolding?.(accumRef.current);
        }, TICK_MS);
    }, [disabled, onHolding]);

    const progress = Math.min(accum / 100, 1);
    // Stable ref — inline object literals fail useEffect dep check on every re-render,
    // causing CoolMode to teardown/recreate the effect each tick and leak closures
    // where autoAddParticle stays true forever.
    const coolOptions = useMemo(() => ({ particle: '₿', size: 1, speedUp: 12 }), []);

    return (
        <CoolMode options={coolOptions}>
            <button
                onPointerDown={start}
                onPointerUp={stop}
                onPointerCancel={stop}
                disabled={disabled}
                className={cn(
                    'relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold select-none transition-all duration-150 overflow-hidden',
                    holding
                        ? 'bg-[oklch(0.97_0.20_75)] text-[oklch(0.14_0.02_80)] ring-2 ring-[oklch(0.88_0.12_75)/0.7]'
                        : 'bg-[oklch(0.88_0.12_75)] text-[oklch(0.18_0.02_80)]',
                    disabled && 'opacity-40 cursor-not-allowed',
                )}>
                {holding && (
                    <span
                        className="absolute inset-0 origin-left transition-transform duration-300"
                        style={{ transform: `scaleX(${progress})`, background: 'oklch(0.82 0.18 75 / 0.4)' }}
                    />
                )}
                <span className="relative mono text-[10px] font-bold">+10</span>
                <span className="relative tabular-nums">
                    {holding && accum > 0 ? `${accum} coins` : 'Tip'}
                </span>
            </button>
        </CoolMode>
    );
};
