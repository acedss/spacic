import { Check } from 'lucide-react';
import { AVATAR_BG, type OnboardingCreator } from './onboarding-shared';
import { StepFooter, StepHead } from './onboarding-atoms';

export const StepCircle = ({ creators, following, toggle, onBack, onNext }: {
    creators: OnboardingCreator[]; following: Set<string>; toggle: (id: string) => void;
    onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="04 · Circle"
            title={<>Find the people who <em className="italic">play your songs.</em></>}
            sub="Follow creators — their rooms will appear on your home feed."
        />
        <div className="grid grid-cols-3 gap-4 mt-10 max-w-[980px]">
            {creators.map(c => {
                const on = following.has(c._id);
                return (
                    <div key={c._id}
                        className={`relative rounded-2xl ring-1 p-5 transition-all ${on ? 'ring-[oklch(0.68_0.21_295)]' : 'ring-white/10 hover:ring-white/20'}`}
                        style={{ background: 'var(--ink-2)' }}>
                        <div className="flex items-center gap-3">
                            {c.imageUrl ? (
                                <img src={c.imageUrl} className="w-14 h-14 rounded-full object-cover ring-1 ring-white/15 shrink-0" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-full ring-1 ring-white/15 grid place-items-center text-[18px] font-bold text-white shrink-0"
                                    style={{ background: AVATAR_BG(c.fullName) }}>
                                    {c.fullName[0]}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-white">{c.fullName}</p>
                                <p className="text-[11px] mono" style={{ color: 'var(--fg-3)' }}>
                                    {c.username ? `@${c.username}` : 'creator'}
                                    {c.creatorStats?.totalStreams ? ` · ${c.creatorStats.totalStreams.toLocaleString()} streams` : ''}
                                </p>
                            </div>
                        </div>
                        <p className="mt-3 text-[12px] leading-snug" style={{ color: 'var(--fg-2)' }}>
                            {c.creatorStats?.totalRoomsHosted
                                ? `Hosted ${c.creatorStats.totalRoomsHosted} rooms`
                                : 'New creator'}
                        </p>
                        <button onClick={() => toggle(c._id)}
                            className={`mt-4 w-full h-9 rounded-lg text-[12px] font-medium press ring-1 transition-all ${on ? 'bg-[oklch(0.68_0.21_295)] text-white ring-[oklch(0.68_0.21_295)]'
                                : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'
                                }`}>
                            {on ? <><Check className="inline size-3.5 mr-1 -mt-0.5" /> Following</> : 'Follow'}
                        </button>
                    </div>
                );
            })}
        </div>
        <StepFooter selected={following.size} min={0} optional onBack={onBack} onNext={onNext} />
    </div>
);
