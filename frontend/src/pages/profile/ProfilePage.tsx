import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
    User, Shield, CreditCard, BarChart2,
    Zap, Crown, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWalletStore } from '@/stores/useWalletStore';
import { ProfileSection } from './components/ProfileSection';
import { AccountSection } from './components/AccountSection';
import { BillingSection } from './components/BillingSection';
import { StatsSection } from './components/StatsSection';

// ── Types ──────────────────────────────────────────────────────────────────────

type SectionId = 'profile' | 'account' | 'billing' | 'stats';

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV: { id: SectionId; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile',       icon: User      },
    { id: 'account', label: 'Account',       icon: Shield    },
    { id: 'billing', label: 'Billing',       icon: CreditCard },
    { id: 'stats',   label: 'Creator Stats', icon: BarChart2 },
];

const TIER_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    FREE:    { label: 'Free',    color: 'bg-zinc-700/60 text-zinc-300',  icon: Zap   },
    PREMIUM: { label: 'Premium', color: 'bg-purple-500/80 text-white',   icon: Star  },
    CREATOR: { label: 'Creator', color: 'bg-yellow-500/80 text-black',   icon: Crown },
};

const SECTION_TITLES: Record<SectionId, { title: string; description: string }> = {
    profile: { title: 'Profile',       description: 'Manage your public identity and username'           },
    account: { title: 'Account',       description: 'Security, email addresses and connected accounts'   },
    billing: { title: 'Billing',       description: 'Your plan, wallet balance and transaction history'   },
    stats:   { title: 'Creator Stats', description: 'Lifetime metrics from your hosted rooms'            },
};

// ── Page ───────────────────────────────────────────────────────────────────────

const ProfilePage = () => {
    const { user } = useUser();
    const { userTier } = useWalletStore();
    const [active, setActive] = useState<SectionId>('profile');

    const tier = TIER_META[userTier] ?? TIER_META.FREE;
    const TierIcon = tier.icon;
    const meta = SECTION_TITLES[active];

    return (
        <div className="flex flex-col md:flex-row h-full min-h-0 bg-zinc-950">

            {/* ── Desktop sidebar ── */}
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/10">
                <div className="px-5 py-5 shrink-0">
                    <h1 className="text-lg font-bold text-white">Settings</h1>
                </div>

                <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                    {NAV.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActive(id)}
                            className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                                active === id
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5',
                            )}
                        >
                            <Icon className="size-4 shrink-0" />
                            {label}
                        </button>
                    ))}
                </nav>

                {/* User info at bottom */}
                <div className="px-4 py-4 border-t border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <img
                            src={user?.imageUrl}
                            alt={user?.fullName ?? ''}
                            className="size-8 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <TierIcon className="size-3 text-zinc-400" />
                                <span className="text-[10px] text-zinc-500">{tier.label} plan</span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Mobile tab bar ── */}
            <div className="md:hidden flex overflow-x-auto border-b border-white/10 shrink-0 px-2 py-1 gap-1">
                {NAV.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActive(id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors shrink-0',
                            active === id
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-zinc-500 hover:text-white',
                        )}
                    >
                        <Icon className="size-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-6 md:px-10 md:py-8 max-w-3xl">
                    {/* Section header */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white">{meta.title}</h2>
                        <p className="text-sm text-zinc-500 mt-1">{meta.description}</p>
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
