import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
    User, Shield, CreditCard, BarChart2,
    Zap, Crown, Star, Music2, Gamepad2, Gem, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWalletStore } from '@/stores/useWalletStore';
import { ProfileSection } from './components/ProfileSection';
import { AccountSection } from './components/AccountSection';
import { BillingSection } from './components/BillingSection';
import { StatsSection } from './components/StatsSection';

type SectionId = 'profile' | 'account' | 'billing' | 'stats';

const NAV: { id: SectionId; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile',       icon: User       },
    { id: 'account', label: 'Account',       icon: Shield     },
    { id: 'billing', label: 'Billing',       icon: CreditCard },
    { id: 'stats',   label: 'Creator Stats', icon: BarChart2  },
];

const TIER_META: Record<string, { label: string; icon: React.ElementType; accent: string }> = {
    FREE:    { label: 'Free',    icon: Zap,   accent: 'oklch(0.6 0.01 285)' },
    PREMIUM: { label: 'Premium', icon: Star,  accent: 'oklch(0.72 0.18 295)' },
    CREATOR: { label: 'Creator', icon: Crown, accent: 'oklch(0.88 0.12 75)'  },
};

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 px-3">
            <Icon className="size-3.5 mb-0.5" style={{ color: 'var(--fg-3)' }} />
            <span className="mono text-[15px] font-bold text-white tabular-nums leading-none">{value}</span>
            <span className="mono text-[8px] uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--fg-3)' }}>{label}</span>
        </div>
    );
}

const ProfilePage = () => {
    const { user } = useUser();
    const { userTier, activityStats } = useWalletStore();
    const [active, setActive] = useState<SectionId>('profile');

    const tier = TIER_META[userTier] ?? TIER_META.FREE;
    const TierIcon = tier.icon;
    const joinedYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;

    return (
        <div className="flex flex-col md:flex-row h-full min-h-0" style={{ background: 'var(--ink-0)' }}>

            {/* ── Desktop sidebar ── */}
            <aside className="hidden md:flex w-60 shrink-0 flex-col border-r hair" style={{ background: 'var(--ink-1)' }}>

                {/* Profile hero */}
                <div className="relative overflow-hidden shrink-0">
                    <div className="aurora absolute inset-0 opacity-30" />
                    <div className="grain absolute inset-0 opacity-20" />
                    <div className="relative px-5 pt-6 pb-5">
                        <div className="flex items-end gap-3 mb-3">
                            <div className="relative">
                                <img
                                    src={user?.imageUrl}
                                    alt={user?.fullName ?? ''}
                                    className="w-14 h-14 rounded-full object-cover"
                                    style={{ outline: `2px solid ${tier.accent}`, outlineOffset: '2px', boxShadow: `0 0 16px ${tier.accent}55` }}
                                />
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full mono text-[8px] font-bold ring-1 ring-white/10"
                                    style={{ background: 'var(--ink-2)', color: tier.accent }}>
                                    <TierIcon className="size-2.5" />
                                    {tier.label}
                                </span>
                            </div>
                            <div className="pb-1 min-w-0">
                                <p className="text-[13px] font-bold text-white truncate leading-tight">{user?.fullName}</p>
                                {joinedYear && (
                                    <p className="text-[9px] mono mt-0.5 flex items-center gap-1" style={{ color: 'var(--fg-3)' }}>
                                        <Calendar className="size-2.5" />Since {joinedYear}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quick stats row */}
                        <div className="flex items-center justify-around py-2.5 rounded-xl ring-1 ring-white/6"
                            style={{ background: 'var(--ink-2)' }}>
                            <MiniStat icon={Music2}    label="Rooms"    value={activityStats.roomsJoined} />
                            <div className="w-px h-8 bg-white/8" />
                            <MiniStat icon={Gamepad2}  label="Games"    value={activityStats.gamesPlayed} />
                            <div className="w-px h-8 bg-white/8" />
                            <MiniStat icon={Gem}       label="Donated"  value={activityStats.donationsMade} />
                        </div>
                    </div>
                    <div className="h-px hair" />
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    <p className="mono text-[8px] uppercase tracking-widest px-2 mb-2" style={{ color: 'var(--fg-3)' }}>Settings</p>
                    {NAV.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActive(id)}
                            className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] transition-colors text-left press',
                                active === id
                                    ? 'bg-white/10 text-white font-semibold'
                                    : 'text-white/50 hover:text-white hover:bg-white/5',
                            )}>
                            <Icon className="size-3.5 shrink-0" />
                            {label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* ── Mobile tab bar ── */}
            <div className="md:hidden flex overflow-x-auto border-b hair shrink-0 px-2 py-1 gap-1" style={{ background: 'var(--ink-1)' }}>
                {/* Mini avatar + name */}
                <div className="flex items-center gap-2 px-2 mr-2 shrink-0">
                    <img src={user?.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    <span className="text-[12px] font-semibold text-white truncate max-w-[100px]">{user?.firstName}</span>
                </div>
                {NAV.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActive(id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors shrink-0 press',
                            active === id ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white',
                        )}>
                        <Icon className="size-3" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-7 md:px-10 md:py-8 max-w-3xl">

                    {/* Section header */}
                    <div className="mb-7">
                        <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>
                            {active === 'profile' && 'Identity'}
                            {active === 'account' && 'Security'}
                            {active === 'billing' && 'Plan & Wallet'}
                            {active === 'stats'   && 'Analytics'}
                        </p>
                        <h2 className="serif italic text-white" style={{ fontSize: 26 }}>
                            {active === 'profile' && 'Your Profile'}
                            {active === 'account' && 'Account'}
                            {active === 'billing' && 'Billing'}
                            {active === 'stats'   && 'Creator Stats'}
                        </h2>
                    </div>

                    {active === 'profile' && <ProfileSection />}
                    {active === 'account' && <AccountSection />}
                    {active === 'billing' && <BillingSection />}
                    {active === 'stats'   && <StatsSection />}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
