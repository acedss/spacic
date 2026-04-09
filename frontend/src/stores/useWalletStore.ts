import { create } from 'zustand';
import type { Transaction, TopupPackage } from '@/types/types';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';

interface WalletStore {
    balance: number;
    userTier: string;
    transactions: Transaction[];
    packages: TopupPackage[];
    loading: boolean;
    topupLoading: boolean;
    loadingMore: boolean;
    nextCursor: string | null;
    hasMore: boolean;
    hasFetched: boolean;

    fetchWallet: () => Promise<void>;
    fetchPackages: () => Promise<void>;
    startTopup: (packageId: string) => Promise<void>;
    loadMore: () => Promise<void>;
    setBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
    balance: 0,
    userTier: 'FREE',
    transactions: [],
    packages: [],
    loading: false,
    topupLoading: false,
    loadingMore: false,
    nextCursor: null,
    hasMore: false,
    hasFetched: false,

    fetchWallet: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/wallet');
            set({
                balance: data.data.balance,
                userTier: data.data.userTier,
                transactions: data.data.transactions,
                nextCursor: data.data.nextCursor,
                hasMore: data.data.hasMore,
                hasFetched: true,
            });
        } catch {
            toast.error('Failed to load wallet');
        } finally {
            set({ loading: false });
        }
    },

    loadMore: async () => {
        const { nextCursor, loadingMore } = get();
        if (!nextCursor || loadingMore) return;
        set({ loadingMore: true });
        try {
            const { data } = await axiosInstance.get(`/wallet?cursor=${nextCursor}`);
            set((state) => ({
                transactions: [...state.transactions, ...data.data.transactions],
                nextCursor: data.data.nextCursor,
                hasMore: data.data.hasMore,
            }));
        } catch {
            toast.error('Failed to load more transactions');
        } finally {
            set({ loadingMore: false });
        }
    },

    fetchPackages: async () => {
        try {
            const { data } = await axiosInstance.get('/wallet/packages');
            set({ packages: data.data });
        } catch {
            toast.error('Failed to load packages');
        }
    },

    startTopup: async (packageId) => {
        set({ topupLoading: true });
        try {
            const { data } = await axiosInstance.post('/wallet/topup', { packageId });
            // Redirect to Stripe hosted checkout page
            window.location.href = data.data.url;
        } catch {
            toast.error('Failed to start checkout');
            set({ topupLoading: false });
        }
    },

    // Called by socket listener when wallet:balance_updated fires
    setBalance: (balance) => set({ balance }),
}));
