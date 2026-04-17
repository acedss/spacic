import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanCard } from './components/PlanCard';
import { FreePlanCard } from './components/FreePlanCard';
import { ManageBanner } from './components/ManageBanner';

// ── Main page ─────────────────────────────────────────────────────────────────

const SubscriptionPage = () => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [searchParams, setSearchParams] = useSearchParams();

    const { plans, loading, subscribeLoading, fetchPlans, fetchSubStatus, startSubscribe } = useSubscriptionStore();
    const { userTier, fetchWallet } = useWalletStore();

    useEffect(() => {
        fetchPlans();
        fetchWallet();   // needed for userTier
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

    const hasYearly = plans.some((p) => p.priceYearlyUsd != null);

    return (
        <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">

            {/* Header */}
            <div className="text-center max-w-lg mx-auto">
                <h1 className="text-3xl font-bold text-white mb-3">Choose Your Plan</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Unlock bigger rooms, better audio, and exclusive creator tools.
                </p>

                {/* Billing toggle */}
                {hasYearly && (
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <Label htmlFor="billing-toggle" className={cn('text-sm cursor-pointer', billingCycle === 'monthly' ? 'text-white' : 'text-zinc-500')}>
                            Monthly
                        </Label>
                        <Switch
                            id="billing-toggle"
                            checked={billingCycle === 'yearly'}
                            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
                            className="data-[state=checked]:bg-purple-500"
                        />
                        <Label htmlFor="billing-toggle" className={cn('text-sm flex items-center gap-1.5 cursor-pointer', billingCycle === 'yearly' ? 'text-white' : 'text-zinc-500')}>
                            Yearly
                            <Badge className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                                Save 20%
                            </Badge>
                        </Label>
                    </div>
                )}
            </div>

            {/* Manage active subscription */}
            <ManageBanner />

            {/* Plan cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-2xl border border-white/10 p-6 space-y-4">
                            <Skeleton className="size-10 rounded-xl bg-white/5" />
                            <Skeleton className="h-6 w-24 bg-white/5" />
                            <Skeleton className="h-8 w-20 bg-white/5" />
                            <div className="space-y-2 my-4">
                                {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-4 w-full bg-white/5" />)}
                            </div>
                            <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FreePlanCard isCurrentPlan={userTier === 'FREE'} />

                    {plans.map((plan) => (
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

            {/* Footer note */}
            <p className="text-center text-xs text-zinc-600 pb-4">
                Subscriptions renew automatically. Cancel anytime from your account settings.
                Payments processed securely by Stripe.
            </p>
        </div>
    );
};

export default SubscriptionPage;
