import axios from 'axios';
import { create } from 'zustand';
import type { Transaction, TopupPackage } from '@/types/types';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';

export interface ConnectStatus {
    winPoints:            number;
    stripeConnectStatus:  'pending' | 'active' | 'restricted' | null;
    hasConnectAccount:    boolean;
    minWithdrawWinPoints: number;
    winPointsToUsdCents:  number;
    withdrawFeePercent:   number;
    activityStats: {
        roomsJoined:    number;
        gamesPlayed:    number;
        donationsMade:  number;
        totalWithdrawn: number;
    };
}

interface WalletStore {
    balance:             number;
    winPoints:           number;
    userTier:            string;
    stripeConnectStatus: 'pending' | 'active' | 'restricted' | null;
    activityStats: {
        roomsJoined:   number;
        gamesPlayed:   number;
        donationsMade: number;
        totalWithdrawn:number;
    };
    transactions:  Transaction[];
    packages:      TopupPackage[];
    loading:       boolean;
    topupLoading:  boolean;
    loadingMore:   boolean;
    nextCursor:    string | null;
    hasMore:       boolean;
    hasFetched:    boolean;

    // Connect + withdrawal
    connectStatus:  ConnectStatus | null;
    connectLoading: boolean;
    withdrawLoading:boolean;

    fetchWallet:        () => Promise<void>;
    fetchPackages:      () => Promise<void>;
    startTopup:         (packageId: string) => Promise<void>;
    loadMore:           () => Promise<void>;
    setBalance:         (balance: number) => void;
    fetchConnectStatus: () => Promise<void>;
    onboardConnect:     () => Promise<void>;
    withdrawWinPoints:  (amount: number) => Promise<{ grossUsd: string; feeUsd: string; netUsd: string }>;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
    balance:             0,
    winPoints:           0,
    userTier:            'FREE',
    stripeConnectStatus: null,
    activityStats: { roomsJoined: 0, gamesPlayed: 0, donationsMade: 0, totalWithdrawn: 0 },
    transactions:        [],
    packages:            [],
    loading:             false,
    topupLoading:        false,
    loadingMore:         false,
    nextCursor:          null,
    hasMore:             false,
    hasFetched:          false,
    connectStatus:       null,
    connectLoading:      false,
    withdrawLoading:     false,

    fetchWallet: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/wallet');
            set({
                balance:             data.data.balance,
                winPoints:           data.data.winPoints ?? 0,
                userTier:            data.data.userTier,
                stripeConnectStatus: data.data.stripeConnectStatus ?? null,
                activityStats:       data.data.activityStats ?? {},
                transactions:        data.data.transactions,
                nextCursor:          data.data.nextCursor,
                hasMore:             data.data.hasMore,
                hasFetched:          true,
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
                nextCursor:   data.data.nextCursor,
                hasMore:      data.data.hasMore,
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
            window.location.href = data.data.url;
        } catch (error) {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? (error.response?.data?.message ?? 'Failed to start checkout')
                : 'Failed to start checkout';
            toast.error(message);
        } finally {
            set({ topupLoading: false });
        }
    },

    fetchConnectStatus: async () => {
        set({ connectLoading: true });
        try {
            const { data } = await axiosInstance.get('/wallet/connect/status');
            set({ connectStatus: data.data });
        } catch {
            toast.error('Failed to load Stripe Connect status');
        } finally {
            set({ connectLoading: false });
        }
    },

    onboardConnect: async () => {
        set({ connectLoading: true });
        try {
            const { data } = await axiosInstance.post('/wallet/connect/onboard');
            // Redirect to Stripe Connect onboarding
            window.location.href = data.data.url;
        } catch (error) {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? (error.response?.data?.message ?? 'Failed to start Connect onboarding')
                : 'Failed to start Connect onboarding';
            toast.error(message);
            set({ connectLoading: false });
        }
    },

    withdrawWinPoints: async (amount) => {
        set({ withdrawLoading: true });
        try {
            const { data } = await axiosInstance.post('/wallet/withdraw', { amount });
            // Deduct from local state immediately
            set(s => ({ winPoints: Math.max(0, s.winPoints - amount) }));
            return data.data as { grossUsd: string; feeUsd: string; netUsd: string };
        } catch (error) {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? (error.response?.data?.message ?? 'Withdrawal failed')
                : 'Withdrawal failed';
            toast.error(message);
            throw new Error(message);
        } finally {
            set({ withdrawLoading: false });
        }
    },

    setBalance: (balance) => set({ balance }),
}));
