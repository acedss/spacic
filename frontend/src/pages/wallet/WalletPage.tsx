import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Wallet, TrendingUp, ArrowUpRight, Loader,
    Zap, Crown, Star, ChevronRight, ChevronDown, Coins,
} from 'lucide-react';
import { useWalletStore } from '@/stores/useWalletStore';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageCard } from './components/PackageCard';
import { TransactionRow } from './components/TransactionRow';
import { WinPointsCard } from './components/WinPointsCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
    FREE:    { label: 'Free',    icon: Zap,   color: 'text-zinc-400',   bg: 'bg-zinc-400/10'   },
    PREMIUM: { label: 'Premium', icon: Star,  color: 'text-purple-400', bg: 'bg-purple-400/10' },
    CREATOR: { label: 'Creator', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
} as const;

type TxFilter = 'all' | 'coins' | 'winpoints';

const WalletPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [txFilter, setTxFilter] = useState<TxFilter>('all');

    const {
        balance, userTier, transactions, packages,
        loading, topupLoading, loadingMore, hasMore,
        fetchWallet, fetchPackages, startTopup, loadMore, fetchConnectStatus,
    } = useWalletStore();

    useEffect(() => {
        fetchWallet();
        fetchPackages();
    }, [fetchWallet, fetchPackages]);

    // Handle Stripe redirects
    useEffect(() => {
        const topupStatus   = searchParams.get('topup');
        const connectStatus = searchParams.get('connect');

        if (topupStatus === 'success') {
            toast.success('Top-up successful! Credits added to your wallet.');
            fetchWallet();
            setSearchParams({});
        } else if (topupStatus === 'cancelled') {
            toast.info('Top-up cancelled.');
            setSearchParams({});
        }

        if (connectStatus === 'return') {
            // User came back from Stripe Connect onboarding — verify status
            axiosInstance.get('/wallet/connect/return')
                .then(() => {
                    toast.success('Stripe account connected!');
                    fetchConnectStatus();
                })
                .catch(() => toast.error('Could not verify Stripe connection — try again'))
                .finally(() => setSearchParams({}));
        }
    }, [searchParams, fetchWallet, fetchPackages, fetchConnectStatus, setSearchParams]);

    const tier    = TIER_CONFIG[userTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.FREE;
    const TierIcon = tier.icon;

    // Filter transactions by currency type
    const COIN_TYPES = new Set(['topup', 'donation', 'minigame_debit', 'minigame_refund'])
    const WP_TYPES   = new Set(['goal_payout', 'minigame_win', 'creator_earning', 'withdrawal', 'withdrawal_fee'])

    const filteredTx = transactions.filter(tx => {
        if (txFilter === 'all')       return true;
        if (txFilter === 'coins')     return COIN_TYPES.has(tx.type);
        if (txFilter === 'winpoints') return WP_TYPES.has(tx.type);
        return true;
    });

    const coinCount = transactions.filter(t => COIN_TYPES.has(t.type)).length;
    const wpCount   = transactions.filter(t => WP_TYPES.has(t.type)).length;

    return (
        <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto">

            {/* ── Coins balance card ─────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6
                            bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-pink-600/10">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Coin Balance</p>

                        {loading ? (
                            <div className="mt-2 space-y-2">
                                <Skeleton className="h-12 w-40 bg-white/10" />
                                <Skeleton className="h-4 w-12 bg-white/10" />
                            </div>
                        ) : (
                            <>
                                <p className="text-5xl font-bold tracking-tight text-white">
                                    {balance.toLocaleString()}
                                </p>
                                <p className="text-sm text-zinc-500 mt-1">🪙 coins · donate to rooms &amp; fund minigames</p>
                            </>
                        )}

                        <div className="flex items-center gap-3 mt-4">
                            <Badge className={cn('gap-1.5 text-xs font-semibold', tier.bg, tier.color, 'border-0 hover:opacity-100')}>
                                <TierIcon className="size-3" />
                                {tier.label} Plan
                            </Badge>

                            {userTier === 'FREE' && (
                                <Link
                                    to="/subscription"
                                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                                >
                                    Upgrade <ChevronRight className="size-3" />
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="bg-yellow-500/15 rounded-xl p-3 flex-shrink-0">
                        <Coins className="size-6 text-yellow-400" />
                    </div>
                </div>
            </div>

            {/* ── WinPoints card ────────────────────────────────────────── */}
            <WinPointsCard />

            {/* ── Upgrade banner (FREE only) ────────────────────────────── */}
            {!loading && userTier === 'FREE' && (
                <Link
                    to="/subscription"
                    className="flex items-center gap-4 p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5
                               hover:bg-purple-500/10 hover:border-purple-500/40 transition-all group"
                >
                    <div className="bg-purple-500/15 rounded-xl p-2.5 flex-shrink-0">
                        <Crown className="size-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Unlock Premium or Creator</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Host bigger rooms, HD audio &amp; stream goals</p>
                    </div>
                    <ChevronRight className="size-4 text-zinc-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                </Link>
            )}

            {/* ── Top-up section ────────────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-5">
                    <TrendingUp className="size-4 text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Add Coins</h2>
                </div>

                {packages.length === 0 && !loading ? (
                    <p className="text-zinc-600 text-sm">No packages available.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                        {packages.map((pkg) => (
                            <PackageCard
                                key={pkg.id}
                                pkg={pkg}
                                onSelect={() => startTopup(pkg.id)}
                                loading={topupLoading}
                            />
                        ))}
                    </div>
                )}

                <p className="text-xs text-zinc-600 mt-4">
                    Payments processed securely by Stripe. Coins are non-refundable.
                </p>
            </div>

            {/* ── Transaction history ───────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className="size-4 text-zinc-400" />
                        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Activity</h2>
                    </div>

                    {transactions.length > 0 && (
                        <Tabs value={txFilter} onValueChange={(v) => setTxFilter(v as TxFilter)}>
                            <TabsList className="bg-white/5 border border-white/5 h-8">
                                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 h-6 px-2.5">
                                    All ({transactions.length})
                                </TabsTrigger>
                                <TabsTrigger value="coins" className="text-xs data-[state=active]:bg-yellow-500/15 data-[state=active]:text-yellow-300 text-zinc-500 h-6 px-2.5">
                                    🪙 Coins ({coinCount})
                                </TabsTrigger>
                                <TabsTrigger value="winpoints" className="text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-zinc-500 h-6 px-2.5">
                                    🏆 WP ({wpCount})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </div>

                {loading ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 space-y-1">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 py-3.5 border-b border-white/5 last:border-0">
                                <Skeleton className="size-9 rounded-xl bg-white/5" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-40 bg-white/5" />
                                    <Skeleton className="h-3 w-24 bg-white/5" />
                                </div>
                                <Skeleton className="h-4 w-20 bg-white/5" />
                            </div>
                        ))}
                    </div>
                ) : filteredTx.length === 0 ? (
                    <div className="text-center py-10 border border-white/5 rounded-2xl">
                        <Wallet className="size-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500 text-sm">
                            {txFilter === 'all'
                                ? 'No transactions yet.'
                                : txFilter === 'coins'
                                    ? 'No coin transactions yet.'
                                    : 'No WinPoints transactions yet.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4">
                            {filteredTx.map((tx) => (
                                <TransactionRow key={tx._id} tx={tx} />
                            ))}
                        </div>

                        {hasMore && txFilter === 'all' && (
                            <Button
                                onClick={loadMore}
                                disabled={loadingMore}
                                variant="ghost"
                                className="mt-3 w-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                            >
                                {loadingMore
                                    ? <Loader className="size-4 animate-spin" />
                                    : <><ChevronDown className="size-4" /> Load more</>
                                }
                            </Button>
                        )}
                    </>
                )}
            </div>

        </div>
    );
};

export default WalletPage;
