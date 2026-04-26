import { Check } from 'lucide-react';
import { GENRES, type GenreId } from './onboarding-shared';
import { StepFooter, StepHead } from './onboarding-atoms';

export const StepTaste = ({ genres, toggle, onBack, onNext }: {
    genres: Set<GenreId>; toggle: (id: GenreId) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="01 · Taste"
            title={<>What does your <em className="italic">night</em> sound like?</>}
            sub="Pick 3 or more. We'll use these to surface rooms and recommend creators."
        />
        <div className="flex flex-wrap gap-2.5 mt-10 max-w-[860px]">
            {GENRES.map(g => (
                <button key={g.id} onClick={() => toggle(g.id)}
                    className={`chip rounded-full px-5 py-2.5 text-[14px] ring-1 ring-white/12 flex items-center gap-2 press ${genres.has(g.id) ? 'chip-on' : ''}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.hue }} />
                    {g.label}
                    {genres.has(g.id) && <Check className="size-3 ml-0.5" />}
                </button>
            ))}
        </div>
        <StepFooter selected={genres.size} min={3} onBack={onBack} onNext={onNext} />
    </div>
);
