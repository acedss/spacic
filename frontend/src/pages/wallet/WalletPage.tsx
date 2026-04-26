import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWalletStore } from '@/stores/useWalletStore';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { CoinBalanceCard } from './components/CoinBalanceCard';
import { WinPointsCard } from './components/WinPointsCard';
import { UpgradeBanner } from './components/UpgradeBanner';
import { TopupGrid } from './components/TopupGrid';
import { ActivitySection } from './components/ActivitySection';
import type { TxFilter } from './components/wallet-shared';

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
            axiosInstance.get('/wallet/connect/return')
                .then(() => {
                    toast.success('Stripe account connected!');
                    fetchConnectStatus();
                })
                .catch(() => toast.error('Could not verify Stripe connection — try again'))
                .finally(() => setSearchParams({}));
        }
    }, [searchParams, fetchWallet, fetchPackages, fetchConnectStatus, setSearchParams]);

    return (
        <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto">
            <CoinBalanceCard balance={balance} userTier={userTier} loading={loading} />
            <WinPointsCard />

            {!loading && userTier === 'FREE' && <UpgradeBanner />}

            <TopupGrid
                packages={packages}
                loading={loading}
                topupLoading={topupLoading}
                onSelect={startTopup}
            />

            <ActivitySection
                transactions={transactions}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                txFilter={txFilter}
                onFilterChange={setTxFilter}
                onLoadMore={loadMore}
            />
        </div>
    );
};

export default WalletPage;
