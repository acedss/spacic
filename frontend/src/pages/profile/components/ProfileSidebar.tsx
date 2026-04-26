import { Music2, Gamepad2, Gem, Calendar } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useWalletStore } from '@/stores/useWalletStore';
import { cn } from '@/lib/utils';
import { NAV, TIER_META, type SectionId } from './profile-shared';
import { MiniStat } from './MiniStat';

interface Props {
    active: SectionId;
    onChange: (id: SectionId) => void;
}

export const ProfileSidebar = ({ active, onChange }: Props) => {
    const { user } = useUser();
    const { userTier, activityStats } = useWalletStore();
    const tier = TIER_META[userTier] ?? TIER_META.FREE;
    const TierIcon = tier.icon;
    const joinedYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;

    return (
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r hair" style={{ background: 'var(--ink-1)' }}>
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

                    <div className="flex items-center justify-around py-2.5 rounded-xl ring-1 ring-white/6"
                        style={{ background: 'var(--ink-2)' }}>
                        <MiniStat icon={Music2}    label="Rooms"   value={activityStats.roomsJoined} />
                        <div className="w-px h-8 bg-white/8" />
                        <MiniStat icon={Gamepad2}  label="Games"   value={activityStats.gamesPlayed} />
                        <div className="w-px h-8 bg-white/8" />
                        <MiniStat icon={Gem}       label="Donated" value={activityStats.donationsMade} />
                    </div>
                </div>
                <div className="h-px hair" />
            </div>

            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                <p className="mono text-[8px] uppercase tracking-widest px-2 mb-2" style={{ color: 'var(--fg-3)' }}>Settings</p>
                {NAV.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => onChange(id)}
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
    );
};
