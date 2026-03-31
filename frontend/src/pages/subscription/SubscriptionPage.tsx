import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Crown, Star, Zap, Loader, Sparkles } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SubscriptionPlan } from '@/types/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const TIER_META = {
    PREMIUM: {
        icon:      Star,
        gradient:  'from-purple-500/20 to-indigo-500/10',
        border:    'border-purple-500/30',
        ring:      'ring-purple-500/60',
        badgeBg:   'bg-purple-500',
        color:     'text-purple-400',
        checkColor:'text-purple-400',
    },
    CREATOR: {
        icon:      Crown,
        gradient:  'from-yellow-500/15 to-orange-500/10',
        border:    'border-yellow-500/30',
        ring:      'ring-yellow-500/60',
        badgeBg:   'bg-yellow-500',
        color:     'text-yellow-400',
        checkColor:'text-yellow-400',
    },
} as const;

// ── Free plan (static, no DB entry) ──────────────────────────────────────────

const FREE_FEATURES = [
    'Join any public room',
    'Chat & send reactions',
    'Up to 10 listeners in your room',
    'Basic audio quality',
];

// ── Plan card ─────────────────────────────────────────────────────────────────

const PlanCard = ({
    plan,
    billingCycle,
    isCurrentPlan,
    onSubscribe,
    loading,
}: {
    plan: SubscriptionPlan;
    billingCycle: 'monthly' | 'yearly';
    isCurrentPlan: boolean;
    onSubscribe: () => void;
    loading: boolean;
}) => {
    const meta = TIER_META[plan.tier];
    const PlanIcon = meta.icon;

    const price = billingCycle === 'yearly' && plan.priceYearlyUsd
        ? plan.priceYearlyUsd / 12
        : plan.priceMonthlyUsd;

    const yearlyTotal = plan.priceYearlyUsd ? toDollars(plan.priceYearlyUsd) : null;

    const canSubscribe = billingCycle === 'yearly'
        ? plan.canSubscribeYearly
        : plan.canSubscribeMonthly;

    const isPremium = plan.tier === 'PREMIUM';

    return (
        <div className={cn(
            'relative flex flex-col rounded-2xl border p-6 transition-all',
            'bg-gradient-to-br',
            meta.gradient,
            meta.border,
            isCurrentPlan && `ring-2 ${meta.ring}`,
        )}>
            {/* Badges */}
            <div className="flex items-start justify-between mb-6">
                <div className={cn('rounded-xl p-2.5', `bg-gradient-to-br ${meta.gradient}`)}>
                    <PlanIcon className={cn('size-5', meta.color)} />
                </div>

                <div className="flex gap-2">
                    {isPremium && !isCurrentPlan && (
                        <span className={cn(
                            'flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white',
                            meta.badgeBg,
                        )}>
                            <Sparkles className="size-2.5" />
                            Popular
                        </span>
                    )}
                    {isCurrentPlan && (
                        <span className={cn(
                            'text-[10px] font-bold px-2.5 py-1 rounded-full border',
                            meta.color, meta.border,
                        )}>
                            Current Plan
                        </span>
                    )}
                </div>
            </div>

            {/* Plan name + price */}
            <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>

            <div className="mb-1">
                <span className="text-3xl font-bold text-white">{toDollars(price)}</span>
                <span className="text-zinc-500 text-sm"> / mo</span>
            </div>

            {billingCycle === 'yearly' && yearlyTotal && (
                <p className="text-xs text-zinc-500 mb-4">{yearlyTotal} billed annually</p>
            )}

            {/* Features */}
            <ul className="flex flex-col gap-2.5 my-5 flex-1">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check className={cn('size-4 mt-0.5 flex-shrink-0', meta.checkColor)} />
                        {f}
                    </li>
                ))}
            </ul>

            {/* CTA */}
            {isCurrentPlan ? (
                <button
                    disabled
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-zinc-500 cursor-default"
                >
                    Current Plan
                </button>
            ) : canSubscribe ? (
                <button
                    onClick={onSubscribe}
                    disabled={loading}
                    className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
                        'text-white flex items-center justify-center gap-2',
                        plan.tier === 'PREMIUM'
                            ? 'bg-purple-500 hover:bg-purple-400 shadow-lg shadow-purple-500/25'
                            : 'bg-yellow-500 hover:bg-yellow-400 shadow-lg shadow-yellow-500/25',
                        loading && 'opacity-60 cursor-not-allowed',
                    )}
                >
                    {loading ? <Loader className="size-4 animate-spin" /> : `Upgrade to ${plan.name}`}
                </button>
            ) : (
                <button
                    disabled
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-zinc-500 cursor-default"
                >
                    Coming Soon
                </button>
            )}
        </div>
    );
};

// ── Free plan card ────────────────────────────────────────────────────────────

const FreePlanCard = ({ isCurrentPlan }: { isCurrentPlan: boolean }) => (
    <div className={cn(
        'relative flex flex-col rounded-2xl border border-white/10 p-6 bg-white/5',
        isCurrentPlan && 'ring-2 ring-white/20',
    )}>
        <div className="flex items-start justify-between mb-6">
            <div className="rounded-xl p-2.5 bg-white/5">
                <Zap className="size-5 text-zinc-400" />
            </div>
            {isCurrentPlan && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 text-zinc-400">
                    Current Plan
                </span>
            )}
        </div>

        <h3 className="text-lg font-bold text-white mb-1">Free</h3>
        <div className="mb-4">
            <span className="text-3xl font-bold text-white">$0</span>
            <span className="text-zinc-500 text-sm"> / mo</span>
        </div>

        <ul className="flex flex-col gap-2.5 my-2 flex-1">
            {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                    <Check className="size-4 mt-0.5 flex-shrink-0 text-zinc-600" />
                    {f}
                </li>
            ))}
        </ul>

        <button
            disabled
            className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-zinc-600 cursor-default"
        >
            {isCurrentPlan ? 'Current Plan' : 'Free'}
        </button>
    </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const SubscriptionPage = () => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [searchParams, setSearchParams] = useSearchParams();

    const { plans, loading, subscribeLoading, fetchPlans, startSubscribe } = useSubscriptionStore();
    const { userTier, fetchWallet } = useWalletStore();

    useEffect(() => {
        fetchPlans();
        fetchWallet();   // needed for userTier
    }, [fetchPlans, fetchWallet]);

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
                        <span className={cn('text-sm', billingCycle === 'monthly' ? 'text-white' : 'text-zinc-500')}>
                            Monthly
                        </span>
                        <button
                            onClick={() => setBillingCycle((c) => c === 'monthly' ? 'yearly' : 'monthly')}
                            className={cn(
                                'relative w-12 h-6 rounded-full transition-all',
                                billingCycle === 'yearly' ? 'bg-purple-500' : 'bg-white/10',
                            )}
                        >
                            <span className={cn(
                                'absolute top-0.5 size-5 bg-white rounded-full shadow transition-all',
                                billingCycle === 'yearly' ? 'left-6' : 'left-0.5',
                            )} />
                        </button>
                        <span className={cn('text-sm flex items-center gap-1.5', billingCycle === 'yearly' ? 'text-white' : 'text-zinc-500')}>
                            Yearly
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Save 20%
                            </span>
                        </span>
                    </div>
                )}
            </div>

            {/* Plan cards */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader className="size-6 animate-spin text-zinc-600" />
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
