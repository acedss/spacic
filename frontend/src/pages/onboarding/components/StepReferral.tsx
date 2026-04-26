import { AtSign, UserPlus } from 'lucide-react';
import { StepFooter, StepHead } from './onboarding-atoms';

export const StepReferral = ({ referral, setReferral, onBack, onNext }: {
    referral: string; setReferral: (v: string) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="05 · Invite"
            title={<>Got a friend <em className="italic">already here?</em></>}
            sub="Enter their username and you'll both get 25 bonus coins. Skip if you don't have one."
        />
        <div className="mt-10 max-w-[480px]">
            <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--fg-3)' }} />
                <input
                    value={referral}
                    onChange={(e) => setReferral(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="friend_username"
                    className="w-full pl-10 pr-4 h-14 rounded-xl bg-white/6 ring-1 ring-white/10 text-[16px] text-white placeholder:text-[var(--fg-3)] outline-none focus:ring-[oklch(0.68_0.21_295_/_0.5)] mono"
                />
            </div>
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl ring-1 ring-[oklch(0.82_0.15_75_/_0.3)]"
                style={{ background: 'oklch(0.22 0.05 75 / 0.3)' }}>
                <UserPlus className="size-5 text-[oklch(0.88_0.12_75)] shrink-0" />
                <div>
                    <p className="text-[13px] text-white font-medium">Referral bonus</p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-2)' }}>
                        Both you and your friend receive <span className="text-[oklch(0.88_0.12_75)] font-semibold">25 coins</span> each.
                    </p>
                </div>
            </div>
        </div>
        <StepFooter selected={referral.length >= 3 ? 1 : 0} min={0} optional onBack={onBack} onNext={onNext} />
    </div>
);
