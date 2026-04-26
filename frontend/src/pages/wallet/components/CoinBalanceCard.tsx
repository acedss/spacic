import { Link } from 'react-router-dom';
import { Coins, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TIER_CONFIG } from './wallet-shared';

interface Props {
    balance: number;
    userTier: string;
    loading: boolean;
}

export const CoinBalanceCard = ({ balance, userTier, loading }: Props) => {
    const tier = TIER_CONFIG[userTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.FREE;
    const TierIcon = tier.icon;

    return (
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
    );
};
