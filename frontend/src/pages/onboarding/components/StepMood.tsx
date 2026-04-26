import { Check } from 'lucide-react';
import { MOODS } from './onboarding-shared';
import { StepFooter, StepHead } from './onboarding-atoms';

export const StepMood = ({ moods, toggle, onBack, onNext }: {
    moods: Set<string>; toggle: (m: string) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="02 · Mood"
            title={<>When are you <em className="italic">tuning in?</em></>}
            sub="Pick the settings you most often find yourself in — we'll match you to the right station."
        />
        <div className="grid grid-cols-4 gap-3 mt-10 max-w-[860px]">
            {MOODS.map((m, i) => {
                const on = moods.has(m);
                const hue = 230 + (i * 17) % 180;
                return (
                    <button key={m} onClick={() => toggle(m)}
                        className={`press relative rounded-xl overflow-hidden ring-1 transition-all ${on ? 'ring-[oklch(0.88_0.12_75)]' : 'ring-white/10 hover:ring-white/25'}`}
                        style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, oklch(0.3 0.09 ${hue}), oklch(0.16 0.04 ${hue + 30}))` }}>
                        <span className="absolute bottom-3 left-3 serif text-[20px] text-white italic">{m}</span>
                        {on && (
                            <span className="absolute top-3 right-3 w-6 h-6 rounded-full grid place-items-center bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)]">
                                <Check className="size-3.5" />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
        <StepFooter selected={moods.size} min={1} onBack={onBack} onNext={onNext} />
    </div>
);
