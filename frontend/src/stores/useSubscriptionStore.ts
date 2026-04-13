import axios from 'axios';
import { create } from 'zustand';
import type { SubscriptionPlan } from '@/types/types';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';

export interface SubStatus {
    tier: string;
    status: 'active' | 'cancel_at_period_end' | 'past_due' | 'canceled' | null;
    currentPeriodEnd: string | null;
    billingCycle: 'monthly' | 'yearly' | null;
    hasStripeSubscription: boolean;
}

interface SubscriptionStore {
    plans: SubscriptionPlan[];
    loading: boolean;
    subscribeLoading: boolean;
    subStatus: SubStatus | null;
    manageLoading: boolean;

    fetchPlans: () => Promise<void>;
    fetchSubStatus: () => Promise<void>;
    startSubscribe: (slug: string, billingCycle: 'monthly' | 'yearly') => Promise<void>;
    cancelSubscription: () => Promise<void>;
    reactivateSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
    plans: [],
    loading: false,
    subscribeLoading: false,
    subStatus: null,
    manageLoading: false,

    fetchPlans: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/subscriptions/plans');
            set({ plans: data.data });
        } catch {
            toast.error('Failed to load subscription plans');
        } finally {
            set({ loading: false });
        }
    },

    fetchSubStatus: async () => {
        try {
            const { data } = await axiosInstance.get('/subscriptions/status');
            set({ subStatus: data.data });
        } catch {
            // Non-critical — page still works without it
        }
    },

    startSubscribe: async (slug, billingCycle) => {
        set({ subscribeLoading: true });
        try {
            const { data } = await axiosInstance.post('/subscriptions/subscribe', { slug, billingCycle });
            const checkoutUrl = data?.data?.url;
            if (!checkoutUrl) throw new Error('Checkout URL was not returned by server');
            window.location.href = checkoutUrl;
        } catch (error) {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? (error.response?.data?.message ?? 'Failed to start checkout')
                : error instanceof Error
                    ? error.message
                    : 'Failed to start checkout';
            toast.error(message);
        } finally {
            set({ subscribeLoading: false });
        }
    },

    cancelSubscription: async () => {
        set({ manageLoading: true });
        try {
            await axiosInstance.delete('/subscriptions/cancel');
            set((s) => ({ subStatus: s.subStatus ? { ...s.subStatus, status: 'cancel_at_period_end' } : null }));
            toast.success('Subscription will cancel at the end of your billing period.');
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to cancel subscription');
        } finally {
            set({ manageLoading: false });
        }
    },

    reactivateSubscription: async () => {
        set({ manageLoading: true });
        try {
            await axiosInstance.post('/subscriptions/reactivate');
            set((s) => ({ subStatus: s.subStatus ? { ...s.subStatus, status: 'active' } : null }));
            toast.success('Subscription reactivated!');
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to reactivate subscription');
        } finally {
            set({ manageLoading: false });
        }
    },
}));
