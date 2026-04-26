import { ArrowRight } from 'lucide-react';

export const Progress = ({ step, total = 7 }: { step: number; total?: number }) => (
    <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-[3px] w-8 rounded-full transition-all duration-500"
                style={{ background: i <= step ? 'oklch(0.88 0.12 75)' : 'oklch(1 0 0 / 0.1)' }} />
        ))}
        <span className="mono text-[10px] ml-2 tabular-nums" style={{ color: 'var(--fg-3)' }}>
            0{step + 1} / 0{total}
        </span>
    </div>
);

export const StepHead = ({ kicker, title, sub }: { kicker: string; title: React.ReactNode; sub: string }) => (
    <div className="max-w-[720px]">
        <div className="mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--fg-3)' }}>{kicker}</div>
        <h1 className="serif text-white leading-[1] tracking-[-0.015em]" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}>{title}</h1>
        <p className="mt-5 text-[16px] leading-relaxed" style={{ color: 'var(--fg-1)' }}>{sub}</p>
    </div>
);

export const StepFooter = ({
    selected, min = 0, optional = false, onBack, onNext, nextLabel = 'Continue',
}: {
    selected: number; min?: number; optional?: boolean;
    onBack: () => void; onNext: () => void; nextLabel?: string;
}) => {
    const canContinue = optional || selected >= min;
    return (
        <div className="mt-12 pt-6 border-t hair flex items-center justify-between">
            <button onClick={onBack}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/15 text-[14px] text-white hover:bg-white/4 press">
                Back
            </button>
            <div className="flex items-center gap-4">
                <span className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
                    {optional ? 'optional' : canContinue ? `${selected} selected` : `${selected}/${min} to continue`}
                </span>
                <button onClick={onNext} disabled={!canContinue}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press disabled:opacity-40 disabled:cursor-not-allowed">
                    {nextLabel} <ArrowRight className="size-3.5" />
                </button>
            </div>
        </div>
    );
};
