import { create } from 'zustand';
import type { SubscriptionPlan } from '@/types/types';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';

interface SubscriptionStore {
    plans: SubscriptionPlan[];
    loading: boolean;
    subscribeLoading: boolean;

    fetchPlans: () => Promise<void>;
    startSubscribe: (slug: string, billingCycle: 'monthly' | 'yearly') => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
    plans: [],
    loading: false,
    subscribeLoading: false,

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

    startSubscribe: async (slug, billingCycle) => {
        set({ subscribeLoading: true });
        try {
            const { data } = await axiosInstance.post('/subscriptions/subscribe', { slug, billingCycle });
            window.location.href = data.data.url;
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Failed to start checkout';
            toast.error(msg);
            set({ subscribeLoading: false });
        }
    },
}));
