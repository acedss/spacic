import { Wallet, ArrowUpRight, Loader, ChevronDown } from 'lucide-react';
import type { Transaction } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { TransactionRow } from './TransactionRow';
import { COIN_TYPES, WP_TYPES, type TxFilter } from './wallet-shared';

interface Props {
    transactions: Transaction[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    txFilter: TxFilter;
    onFilterChange: (f: TxFilter) => void;
    onLoadMore: () => void;
}

export const ActivitySection = ({
    transactions, loading, loadingMore, hasMore, txFilter, onFilterChange, onLoadMore,
}: Props) => {
    const filteredTx = transactions.filter(tx => {
        if (txFilter === 'all')       return true;
        if (txFilter === 'coins')     return COIN_TYPES.has(tx.type);
        if (txFilter === 'winpoints') return WP_TYPES.has(tx.type);
        return true;
    });

    const coinCount = transactions.filter(t => COIN_TYPES.has(t.type)).length;
    const wpCount   = transactions.filter(t => WP_TYPES.has(t.type)).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ArrowUpRight className="size-4 text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Activity</h2>
                </div>

                {transactions.length > 0 && (
                    <Tabs value={txFilter} onValueChange={v => onFilterChange(v as TxFilter)}>
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
                    {[1, 2, 3].map(i => (
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
                <div className="border border-white/5 rounded-2xl">
                    <EmptyState
                        icon={Wallet}
                        tone="zinc"
                        title={
                            txFilter === 'all'     ? 'No transactions yet'
                          : txFilter === 'coins'   ? 'No coin transactions yet'
                          :                          'No WinPoints transactions yet'
                        }
                        description={
                            txFilter === 'all'
                                ? 'Top up coins or earn WinPoints in rooms — your activity will appear here.'
                                : 'Switch to "All" to see every movement, or visit a live room to start earning.'
                        }
                    />
                </div>
            ) : (
                <>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4">
                        {filteredTx.map(tx => (
                            <TransactionRow key={tx._id} tx={tx} />
                        ))}
                    </div>

                    {hasMore && txFilter === 'all' && (
                        <Button
                            onClick={onLoadMore}
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
    );
};
