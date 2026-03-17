import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, TrendingUp, ArrowUpRight, Heart, Loader } from 'lucide-react';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TopupPackage, Transaction } from '@/types/types';

const formatCredits = (credits: number) =>
    `$${(credits / 100).toFixed(2)}`;

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Top-up package card ───────────────────────────────────────────────────────

const PackageCard = ({ pkg, onSelect, loading }: {
    pkg: TopupPackage;
    onSelect: () => void;
    loading: boolean;
}) => (
    <button
        onClick={onSelect}
        disabled={loading}
        className={cn(
            'relative flex flex-col gap-2 p-5 rounded-2xl border transition-all text-left',
            'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
            loading && 'opacity-50 cursor-not-allowed',
            pkg.bonus && 'border-yellow-500/30'
        )}
    >
        {pkg.bonus && (
            <span className="absolute top-3 right-3 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/30">
                {pkg.bonus}
            </span>
        )}
        <span className="text-2xl font-bold text-white">
            {formatCredits(pkg.priceInCents)}
        </span>
        <span className="text-sm text-zinc-400">
            {pkg.credits.toLocaleString()} credits
        </span>
        <span className="text-xs text-zinc-600">{pkg.label}</span>
    </button>
);

// ── Transaction row ───────────────────────────────────────────────────────────

const TransactionRow = ({ tx }: { tx: Transaction }) => (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
        <div className={cn(
            'size-8 rounded-full flex items-center justify-center flex-shrink-0',
            tx.type === 'topup' ? 'bg-emerald-500/15' : 'bg-pink-500/15'
        )}>
            {tx.type === 'topup'
                ? <ArrowUpRight className="size-4 text-emerald-400" />
                : <Heart className="size-4 text-pink-400" />
            }
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
                {tx.type === 'topup' ? 'Wallet Top-up' : `Donated to ${tx.roomId?.title ?? 'a room'}`}
            </p>
            <p className="text-xs text-zinc-500">{formatDate(tx.createdAt)}</p>
        </div>

        <span className={cn(
            'text-sm font-semibold tabular-nums flex-shrink-0',
            tx.type === 'topup' ? 'text-emerald-400' : 'text-pink-400'
        )}>
            {tx.type === 'topup' ? '+' : '-'}{formatCredits(tx.amount)}
        </span>
    </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const WalletPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { balance, transactions, packages, loading, topupLoading, fetchWallet, fetchPackages, startTopup } = useWalletStore();

    useEffect(() => {
        fetchWallet();
        fetchPackages();
    }, [fetchWallet, fetchPackages]);

    // Handle redirect back from Stripe
    useEffect(() => {
        const status = searchParams.get('topup');
        if (status === 'success') {
            toast.success('Top-up successful! Credits have been added to your wallet.');
            fetchWallet(); // re-fetch to show updated balance
            setSearchParams({});
        } else if (status === 'cancelled') {
            toast.info('Top-up cancelled.');
            setSearchParams({});
        }
    }, [searchParams, fetchWallet, setSearchParams]);

    return (
        <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto">

            {/* Balance card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-white/10 rounded-2xl p-6">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent" />
                <div className="relative flex items-start justify-between">
                    <div>
                        <p className="text-sm text-zinc-400 mb-1">Available Balance</p>
                        {loading
                            ? <Loader className="size-6 animate-spin text-zinc-400 mt-2" />
                            : <p className="text-4xl font-bold tracking-tight">{formatCredits(balance)}</p>
                        }
                        <p className="text-xs text-zinc-600 mt-1">{balance.toLocaleString()} credits</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3">
                        <Wallet className="size-6 text-purple-300" />
                    </div>
                </div>
            </div>

            {/* Top-up section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="size-4 text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Add Credits</h2>
                </div>

                {packages.length === 0 && !loading ? (
                    <p className="text-zinc-600 text-sm">No packages available.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

                <p className="text-xs text-zinc-600 mt-3">
                    Payments are processed securely by Stripe. Credits are non-refundable.
                </p>
            </div>

            {/* Transaction history */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <ArrowUpRight className="size-4 text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Recent Activity</h2>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader className="size-5 animate-spin text-zinc-600" />
                    </div>
                ) : transactions.length === 0 ? (
                    <p className="text-zinc-600 text-sm py-4">No transactions yet. Add credits to get started.</p>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4">
                        {transactions.map((tx) => (
                            <TransactionRow key={tx._id} tx={tx} />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default WalletPage;
