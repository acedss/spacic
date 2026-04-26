import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { PlanCard } from './components/PlanCard';
import { FreePlanCard } from './components/FreePlanCard';
import { ManageBanner } from './components/ManageBanner';
import { BillingToggle } from './components/BillingToggle';
import { PlanGridSkeleton } from './components/PlanGridSkeleton';

const SubscriptionPage = () => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [searchParams, setSearchParams] = useSearchParams();

    const { plans, loading, subscribeLoading, fetchPlans, fetchSubStatus, startSubscribe } = useSubscriptionStore();
    const { userTier, fetchWallet } = useWalletStore();

    useEffect(() => {
        fetchPlans();
        fetchWallet();
        fetchSubStatus();
    }, [fetchPlans, fetchWallet, fetchSubStatus]);

    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'success') {
            toast.success('Subscription activated! Your plan has been upgraded.');
            fetchWallet();
            setSearchParams({});
        } else if (status === 'cancelled') {
            toast.info('Subscription cancelled.');
            setSearchParams({});
        }
    }, [searchParams, fetchWallet, setSearchParams]);

    const hasYearly = plans.some(p => p.priceYearlyUsd != null);

    return (
        <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
            <div className="text-center max-w-lg mx-auto">
                <h1 className="text-3xl font-bold text-white mb-3">Choose Your Plan</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Unlock bigger rooms, better audio, and exclusive creator tools.
                </p>
                {hasYearly && <BillingToggle cycle={billingCycle} onChange={setBillingCycle} />}
            </div>

            <ManageBanner />

            {loading ? (
                <PlanGridSkeleton />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FreePlanCard isCurrentPlan={userTier === 'FREE'} />
                    {plans.map(plan => (
                        <PlanCard
                            key={plan.slug}
                            plan={plan}
                            billingCycle={billingCycle}
                            isCurrentPlan={userTier === plan.tier}
                            onSubscribe={() => startSubscribe(plan.slug, billingCycle)}
                            loading={subscribeLoading}
                        />
                    ))}
                </div>
            )}

            <p className="text-center text-xs text-zinc-600 pb-4">
                Subscriptions renew automatically. Cancel anytime from your account settings.
                Payments processed securely by Stripe.
            </p>
        </div>
    );
};

export default SubscriptionPage;
