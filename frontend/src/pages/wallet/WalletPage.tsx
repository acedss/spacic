import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Wallet, TrendingUp, ArrowUpRight, Heart, Loader,
    Zap, Crown, Sparkles, ChevronRight, Star, ChevronDown, Trophy,
} from 'lucide-react';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TopupPackage, Transaction } from '@/types/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toCoins = (credits: number) => `${credits.toLocaleString()} coins`;

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const TIER_CONFIG = {
    FREE:    { label: 'Free',    icon: Zap,    color: 'text-zinc-400',   bg: 'bg-zinc-400/10' },
    PREMIUM: { label: 'Premium', icon: Star,   color: 'text-purple-400', bg: 'bg-purple-400/10' },
    CREATOR: { label: 'Creator', icon: Crown,  color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
} as const;

// ── Package card ──────────────────────────────────────────────────────────────

const PackageCard = ({ pkg, onSelect, loading }: {
    pkg: TopupPackage;
    onSelect: () => void;
    loading: boolean;
}) => (
    <button
        onClick={onSelect}
        disabled={loading}
        className={cn(
            'relative flex flex-col gap-3 p-5 rounded-2xl border transition-all text-left group',
            'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5',
            loading && 'opacity-50 cursor-not-allowed',
            pkg.isFeatured && 'border-purple-500/40 bg-purple-500/5',
        )}
    >
        {pkg.isFeatured && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="flex items-center gap-1 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg shadow-purple-500/30">
                    <Sparkles className="size-2.5" />
                    Most Popular
                </span>
            </div>
        )}

        {pkg.bonus && !pkg.isFeatured && (
            <span className="absolute top-3 right-3 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                {pkg.bonus}
            </span>
        )}

        {pkg.isFeatured && pkg.bonus && (
            <span className="absolute top-3 right-3 bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                {pkg.bonus}
            </span>
        )}

        <span className="text-2xl font-bold text-white mt-1">
            ${(pkg.priceInCents / 100).toFixed(2)}
        </span>
        <div>
            <p className="text-sm font-medium text-white/80">{pkg.credits.toLocaleString()} coins</p>
            <p className="text-xs text-zinc-500 mt-0.5">{pkg.label}</p>
        </div>
    </button>
);

// ── Transaction row ───────────────────────────────────────────────────────────

const TX_META = {
    topup:       { bg: 'bg-emerald-500/15', icon: ArrowUpRight, iconColor: 'text-emerald-400', amountColor: 'text-emerald-400', sign: '+', label: () => 'Wallet Top-up' },
    donation:    { bg: 'bg-pink-500/15',    icon: Heart,         iconColor: 'text-pink-400',    amountColor: 'text-pink-400',    sign: '−', label: (tx: Transaction) => `Donated to "${tx.roomId?.title ?? 'a room'}"` },
    goal_payout: { bg: 'bg-yellow-500/15',  icon: Trophy,        iconColor: 'text-yellow-400',  amountColor: 'text-yellow-400',  sign: '+', label: (tx: Transaction) => `Goal payout from "${tx.roomId?.title ?? 'a room'}"` },
} as const;

const TransactionRow = ({ tx }: { tx: Transaction }) => {
    const meta = TX_META[tx.type] ?? TX_META.topup;
    const Icon = meta.icon;
    return (
        <div className="flex items-center gap-3 py-3.5 border-b border-white/5 last:border-0">
            <div className={cn('size-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                <Icon className={cn('size-4', meta.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{meta.label(tx)}</p>
                <p className="text-xs text-zinc-500">{formatDate(tx.createdAt)}</p>
            </div>
            <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', meta.amountColor)}>
                {meta.sign}{toCoins(tx.amount)}
            </span>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

type TxFilter = 'all' | 'topup' | 'donation';

const WalletPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [txFilter, setTxFilter] = useState<TxFilter>('all');

    const {
        balance, userTier, transactions, packages,
        loading, topupLoading, loadingMore, hasMore,
        fetchWallet, fetchPackages, startTopup, loadMore,
    } = useWalletStore();

    useEffect(() => {
        fetchWallet();
        fetchPackages();
    }, [fetchWallet, fetchPackages]);

    useEffect(() => {
        const status = searchParams.get('topup');
        if (status === 'success') {
            toast.success('Top-up successful! Credits added to your wallet.');
            fetchWallet();
            setSearchParams({});
        } else if (status === 'cancelled') {
            toast.info('Top-up cancelled.');
            setSearchParams({});
        }
    }, [searchParams, fetchWallet, setSearchParams]);

    const tier = TIER_CONFIG[userTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.FREE;
    const TierIcon = tier.icon;

    const filteredTx = transactions.filter((tx) => {
        if (txFilter === 'all') return true;
        if (txFilter === 'topup') return tx.type === 'topup' || tx.type === 'goal_payout';
        return tx.type === txFilter;
    });

    const topupCount    = transactions.filter((t) => t.type === 'topup' || t.type === 'goal_payout').length;
    const donationCount = transactions.filter((t) => t.type === 'donation').length;

    return (
        <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto">

            {/* ── Balance card ──────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6
                            bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-pink-600/10">
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent pointer-events-none" />

                <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">Available Balance</p>

                        {loading ? (
                            <Loader className="size-6 animate-spin text-zinc-400 mt-2" />
                        ) : (
                            <>
                                <p className="text-5xl font-bold tracking-tight text-white">
                                    {balance.toLocaleString()}
                                </p>
                                <p className="text-sm text-zinc-500 mt-1">coins</p>
                            </>
                        )}

                        {/* Tier badge */}
                        <div className="flex items-center gap-3 mt-4">
                            <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full', tier.bg, tier.color)}>
                                <TierIcon className="size-3" />
                                {tier.label} Plan
                            </span>

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

                    <div className="bg-white/10 rounded-xl p-3 flex-shrink-0">
                        <Wallet className="size-6 text-purple-300" />
                    </div>
                </div>
            </div>

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
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Add Credits</h2>
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
                    Payments processed securely by Stripe. Credits are non-refundable.
                </p>
            </div>

            {/* ── Transaction history ───────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className="size-4 text-zinc-400" />
                        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Recent Activity</h2>
                    </div>

                    {/* Filter tabs */}
                    {transactions.length > 0 && (
                        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                            {([
                                { key: 'all',      label: `All (${transactions.length})` },
                                { key: 'topup',    label: `Coins (${topupCount})` },
                                { key: 'donation', label: `Donated (${donationCount})` },
                            ] as { key: TxFilter; label: string }[]).map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setTxFilter(key)}
                                    className={cn(
                                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                                        txFilter === key
                                            ? 'bg-white/10 text-white'
                                            : 'text-zinc-500 hover:text-zinc-300',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader className="size-5 animate-spin text-zinc-600" />
                    </div>
                ) : filteredTx.length === 0 ? (
                    <div className="text-center py-10 border border-white/5 rounded-2xl">
                        <Wallet className="size-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500 text-sm">
                            {txFilter === 'all'
                                ? 'No transactions yet. Add credits to get started.'
                                : `No ${txFilter === 'topup' ? 'top-up' : 'donation'} transactions yet.`}
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
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
                            >
                                {loadingMore
                                    ? <Loader className="size-4 animate-spin" />
                                    : <><ChevronDown className="size-4" />Load more</>
                                }
                            </button>
                        )}
                    </>
                )}
            </div>

        </div>
    );
};

export default WalletPage;
