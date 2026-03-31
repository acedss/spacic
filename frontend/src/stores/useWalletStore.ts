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

    fetchWallet: () => Promise<void>;
    fetchPackages: () => Promise<void>;
    startTopup: (packageId: string) => Promise<void>;
    setBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
    balance: 0,
    userTier: 'FREE',
    transactions: [],
    packages: [],
    loading: false,
    topupLoading: false,

    fetchWallet: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/wallet');
            set({ balance: data.data.balance, userTier: data.data.userTier, transactions: data.data.transactions });
        } catch {
            toast.error('Failed to load wallet');
        } finally {
            set({ loading: false });
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
