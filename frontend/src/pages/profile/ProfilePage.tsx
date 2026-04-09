import { useEffect, useState } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
    User, Shield, CreditCard, BarChart2,
    AtSign, Check, Loader, Clock,
    Radio, Users, Gem, Heart, Trophy,
    ArrowUpRight, Crown, Star, Zap, Wallet,
    TrendingUp, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { axiosInstance } from '@/lib/axios';
import { useWalletStore } from '@/stores/useWalletStore';
import type { Transaction } from '@/types/types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LifetimeStats {
    totalRoomsHosted: number;
    totalStreams: number;
    totalMinutesListened: number;
    totalCoinsEarned: number;
    totalUniqueDonors: number;
    lastLiveAt: string | null;
}

interface RecentRoom {
    _id: string;
    title: string;
    closedAt: string | null;
    stats: {
        totalListeners: number;
        totalMinutesListened: number;
        totalCoinsEarned: number;
        favoriteCount: number;
        topDonors: { name: string; totalCoins: number }[];
    } | null;
}

type SectionId = 'profile' | 'account' | 'billing' | 'stats';

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV: { id: SectionId; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'stats', label: 'Creator Stats', icon: BarChart2 },
];

const TIER_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    FREE: { label: 'Free', color: 'bg-zinc-700/60 text-zinc-300', icon: Zap },
    PREMIUM: { label: 'Premium', color: 'bg-purple-500/80 text-white', icon: Star },
    CREATOR: { label: 'Creator', color: 'bg-yellow-500/80 text-black', icon: Crown },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatAmount = (tx: Transaction) => {
    const sign = tx.type === 'topup' || tx.type === 'goal_payout' ? '+' : '-';
    return `${sign}${Math.abs(tx.amount).toLocaleString()}`;
};

// ── Profile section ────────────────────────────────────────────────────────────

const ProfileSection = () => {
    const { user } = useUser();
    const [input, setInput] = useState(user?.username ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const current = user?.username ?? null;
    const unchanged = input === (current ?? '');

    useEffect(() => { setInput(current ?? '') }, [current]);

    const handleSave = async () => {
        setError(null);
        if (!/^[a-z0-9_]{3,20}$/.test(input)) {
            setError('3–20 chars, lowercase letters, numbers, or underscores only');
            return;
        }
        setSaving(true);
        try {
            await axiosInstance.patch('/auth/username', { username: input });
            await user?.reload();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(msg ?? 'Failed to save username');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Avatar + identity */}
            <div className="flex items-center gap-5">
                <img
                    src={user?.imageUrl}
                    alt={user?.fullName ?? ''}
                    className="size-20 rounded-2xl object-cover ring-2 ring-white/10"
                />
                <div>
                    <h2 className="text-xl font-bold text-white">{user?.fullName}</h2>
                    {current && (
                        <p className="text-sm text-zinc-500 mt-0.5">@{current}</p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1">
                        {user?.primaryEmailAddress?.emailAddress}
                    </p>
                </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Username */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-white">Username</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        Friends can search for you by{' '}
                        <span className="text-purple-400">@username</span>
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                        <Input
                            value={input}
                            onChange={(e) => { setInput(e.target.value.toLowerCase()); setError(null); }}
                            placeholder="e.g. spacic_fan"
                            maxLength={20}
                            className="pl-8 bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500/50"
                        />
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || unchanged}
                        className={cn(
                            'shrink-0 transition-all',
                            saved
                                ? 'bg-green-500 hover:bg-green-500 text-white'
                                : 'bg-purple-600 hover:bg-purple-500 text-white',
                        )}
                    >
                        {saving ? <Loader className="size-4 animate-spin" />
                            : saved ? <><Check className="size-4" /> Saved</>
                                : 'Save'}
                    </Button>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
        </div>
    );
};

// ── Account section ────────────────────────────────────────────────────────────

const AccountSection = () => (
    <div className="w-full max-w-2xl">
        <UserProfile
            appearance={{
                variables: {
                    colorBackground: '#09090b',
                    colorInputBackground: '#18181b',
                    colorInputText: '#ffffff',
                    colorText: '#ffffff',
                    colorTextSecondary: '#a1a1aa',
                    colorPrimary: '#a855f7',
                    colorDanger: '#f87171',
                    borderRadius: '0.75rem',
                },
                elements: {
                    rootBox: 'w-full',
                    card: 'bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl',
                    navbar: 'border-r border-white/10',
                    navbarButton: 'text-zinc-400 hover:text-white hover:bg-white/5',
                    navbarButtonIcon: 'text-zinc-500',
                    headerTitle: 'text-white',
                    headerSubtitle: 'text-zinc-400',
                    formButtonPrimary: 'bg-purple-600 hover:bg-purple-500',
                    formFieldInput: 'bg-zinc-800 border-white/10 text-white',
                    formFieldLabel: 'text-zinc-300',
                    dividerLine: 'bg-white/10',
                    profileSectionTitle: 'text-white',
                    profileSectionContent: 'text-zinc-400',
                    badge: 'bg-purple-500/20 text-purple-300',
                    accordionTriggerButton: 'text-zinc-300 hover:text-white',
                },
            }}
        />
    </div>
);

// ── Subscription status types ──────────────────────────────────────────────────

interface SubStatus {
    tier: string;
    status: 'active' | 'past_due' | 'cancel_at_period_end' | 'canceled' | null;
    currentPeriodEnd: string | null;
    hasActiveSubscription: boolean;
}

// ── Billing section ────────────────────────────────────────────────────────────

const BillingSection = () => {
    const { balance, userTier, transactions, loading, hasFetched, fetchWallet } = useWalletStore();
    const navigate = useNavigate();

    const [sub, setSub] = useState<SubStatus | null>(null);
    const [subLoading, setSubLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => { if (!hasFetched) fetchWallet(); }, [hasFetched, fetchWallet]);

    useEffect(() => {
        axiosInstance.get('/subscriptions/status')
            .then(({ data }) => setSub(data.data))
            .catch(() => { })
            .finally(() => setSubLoading(false));
    }, []);

    const handleCancel = async () => {
        if (!confirm('Cancel your subscription? You keep access until the end of your billing period.')) return;
        setActionLoading(true);
        try {
            const { data } = await axiosInstance.delete('/subscriptions/cancel');
            setSub((prev) => prev ? { ...prev, status: 'cancel_at_period_end', currentPeriodEnd: data.data.currentPeriodEnd } : prev);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg ?? 'Failed to cancel subscription');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivate = async () => {
        setActionLoading(true);
        try {
            await axiosInstance.post('/subscriptions/reactivate');
            setSub((prev) => prev ? { ...prev, status: 'active' } : prev);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg ?? 'Failed to reactivate subscription');
        } finally {
            setActionLoading(false);
        }
    };

    const tier = TIER_META[userTier] ?? TIER_META.FREE;
    const TierIcon = tier.icon;
    const recentTxs = transactions.slice(0, 5);

    const txColor = (tx: Transaction) =>
        tx.type === 'topup' || tx.type === 'goal_payout' ? 'text-green-400' : 'text-red-400';

    const txLabel = (tx: Transaction) => {
        if (tx.type === 'topup') return 'Wallet top-up';
        if (tx.type === 'goal_payout') return `Goal payout${tx.roomId ? ` · ${tx.roomId.title}` : ''}`;
        return `Donation${tx.roomId ? ` · ${tx.roomId.title}` : ''}`;
    };

    const periodEndLabel = sub?.currentPeriodEnd
        ? formatDate(sub.currentPeriodEnd)
        : null;

    return (
        <div className="space-y-6 max-w-2xl">

            {/* Past-due warning banner */}
            {sub?.status === 'past_due' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="size-4 text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-red-300">Payment failed</p>
                        <p className="text-xs text-red-400/80 mt-0.5">
                            We couldn't charge your card. Stripe will retry automatically. Update your payment method to avoid losing access.
                        </p>
                    </div>
                </div>
            )}

            {/* Cancel-at-period-end notice */}
            {sub?.status === 'cancel_at_period_end' && periodEndLabel && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="size-4 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-300">Cancellation scheduled</p>
                        <p className="text-xs text-yellow-400/80 mt-0.5">
                            You still have full access until <span className="font-semibold text-yellow-300">{periodEndLabel}</span>. Changed your mind?
                        </p>
                    </div>
                    <Button
                        size="sm"
                        disabled={actionLoading}
                        onClick={handleReactivate}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold shrink-0"
                    >
                        {actionLoading ? <Loader className="size-3.5 animate-spin" /> : 'Reactivate'}
                    </Button>
                </div>
            )}

            {/* Current plan */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Current Plan</h3>
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                                <TierIcon className="size-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{tier.label}</span>
                                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', tier.color)}>
                                        {tier.label.toUpperCase()}
                                    </span>
                                </div>
                                {subLoading ? (
                                    <div className="h-3 w-32 bg-white/10 rounded animate-pulse mt-1" />
                                ) : (
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {userTier === 'FREE' && 'Basic access to all public rooms'}
                                        {sub?.status === 'active' && periodEndLabel && `Renews ${periodEndLabel}`}
                                        {sub?.status === 'cancel_at_period_end' && periodEndLabel && `Access until ${periodEndLabel}`}
                                        {sub?.status === 'past_due' && 'Payment past due — update payment method'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Cancel button — only for active paying subscribers */}
                            {sub?.status === 'active' && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={actionLoading}
                                    onClick={handleCancel}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                                >
                                    {actionLoading ? <Loader className="size-3.5 animate-spin" /> : 'Cancel'}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-zinc-900 hover:text-white hover:bg-white/5"
                                onClick={() => navigate('/subscription')}
                            >
                                {userTier === 'FREE' ? 'Upgrade' : 'Change plan'}
                                <ArrowUpRight className="size-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Wallet balance */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Wallet</h3>
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <Wallet className="size-5 text-yellow-400" />
                        </div>
                        <div>
                            {loading ? (
                                <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                            ) : (
                                <p className="text-lg font-bold text-yellow-400">
                                    {balance.toLocaleString()} <span className="text-xs font-normal text-zinc-500">coins</span>
                                </p>
                            )}
                            <p className="text-xs text-zinc-500 mt-0.5">Available balance</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold shrink-0"
                        onClick={() => navigate('/wallet')}
                    >
                        Top Up
                    </Button>
                </div>
            </div>

            {/* Recent transactions */}
            {recentTxs.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
                        <button
                            onClick={() => navigate('/wallet')}
                            className="text-xs text-zinc-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                        >
                            View all <ArrowUpRight className="size-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentTxs.map((tx) => (
                            <div key={tx._id} className="flex items-center justify-between py-2.5 px-3 bg-zinc-900 border border-white/10 rounded-lg">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        'size-7 rounded-full flex items-center justify-center shrink-0',
                                        tx.type === 'topup' || tx.type === 'goal_payout' ? 'bg-green-500/10' : 'bg-red-500/10',
                                    )}>
                                        {tx.type === 'topup' || tx.type === 'goal_payout'
                                            ? <TrendingUp className="size-3.5 text-green-400" />
                                            : <TrendingDown className="size-3.5 text-red-400" />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{txLabel(tx)}</p>
                                        <p className="text-[10px] text-zinc-600">{formatDate(tx.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={cn('text-sm font-semibold shrink-0 ml-2', txColor(tx))}>
                                    {formatAmount(tx)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Creator stats section ──────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: string | number; color: string;
}) => (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', color)}>
            <Icon className="size-4 text-white" />
        </div>
        <div>
            <p className="text-lg font-bold text-white leading-none">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
    </div>
);

const StatsSection = () => {
    const [lifetime, setLifetime] = useState<LifetimeStats | null>(null);
    const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get('/rooms/me/creator-stats')
            .then(({ data }) => {
                setLifetime(data.data.lifetime);
                setRecentRooms(data.data.recentRooms);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex justify-center py-12">
            <Loader className="size-5 animate-spin text-zinc-600" />
        </div>
    );

    const stats = lifetime ?? {
        totalRoomsHosted: 0, totalStreams: 0, totalMinutesListened: 0,
        totalCoinsEarned: 0, totalUniqueDonors: 0, lastLiveAt: null,
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                {stats.lastLiveAt && (
                    <p className="text-xs text-zinc-500">Last live: {formatDate(stats.lastLiveAt)}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Radio} label="Rooms Hosted" value={stats.totalRoomsHosted} color="bg-purple-500/30" />
                <StatCard icon={Users} label="Total Streams" value={stats.totalStreams.toLocaleString()} color="bg-blue-500/30" />
                <StatCard icon={Clock} label="Hours Listened" value={toHours(stats.totalMinutesListened)} color="bg-indigo-500/30" />
                <StatCard icon={Gem} label="Coins Earned" value={stats.totalCoinsEarned.toLocaleString()} color="bg-yellow-500/30" />
                <StatCard icon={Heart} label="Unique Donors" value={stats.totalUniqueDonors.toLocaleString()} color="bg-pink-500/30" />
            </div>

            {recentRooms.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent Rooms</h3>
                    <div className="space-y-2">
                        {recentRooms.map((room) => (
                            <div key={room._id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <p className="text-sm font-semibold text-white truncate">{room.title}</p>
                                    {room.closedAt && (
                                        <span className="text-xs text-zinc-600 shrink-0">{formatDate(room.closedAt)}</span>
                                    )}
                                </div>
                                {room.stats ? (
                                    <>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div>
                                                <p className="text-sm font-bold text-white">{room.stats.totalListeners}</p>
                                                <p className="text-[10px] text-zinc-500">listeners</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{toHours(room.stats.totalMinutesListened)}</p>
                                                <p className="text-[10px] text-zinc-500">listened</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-yellow-400">{room.stats.totalCoinsEarned.toLocaleString()}</p>
                                                <p className="text-[10px] text-zinc-500">coins</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-pink-400">{room.stats.favoriteCount}</p>
                                                <p className="text-[10px] text-zinc-500">favorites</p>
                                            </div>
                                        </div>
                                        {room.stats.topDonors.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <Trophy className="size-3" /> Top Donors
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {room.stats.topDonors.map((d, i) => (
                                                        <span key={i} className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                                                            {d.name} · {d.totalCoins.toLocaleString()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-xs text-zinc-600">No stats available</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Page ───────────────────────────────────────────────────────────────────────

const SECTION_TITLES: Record<SectionId, { title: string; description: string }> = {
    profile: { title: 'Profile', description: 'Manage your public identity and username' },
    account: { title: 'Account', description: 'Security, email addresses and connected accounts' },
    billing: { title: 'Billing', description: 'Your plan, wallet balance and transaction history' },
    stats: { title: 'Creator Stats', description: 'Lifetime metrics from your hosted rooms' },
};

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
                    {active === 'stats' && <StatsSection />}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
