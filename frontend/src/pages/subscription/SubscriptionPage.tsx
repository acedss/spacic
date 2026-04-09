import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Crown, Star, Zap, Loader, Sparkles, AlertTriangle, RotateCcw, X, Info } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
                <Button disabled variant="ghost" className="w-full bg-white/5 text-zinc-500 cursor-default rounded-xl">
                    Current Plan
                </Button>
            ) : canSubscribe ? (
                <Button
                    onClick={onSubscribe}
                    disabled={loading}
                    className={cn(
                        'w-full rounded-xl text-sm font-semibold text-white',
                        plan.tier === 'PREMIUM'
                            ? 'bg-purple-500 hover:bg-purple-400 shadow-lg shadow-purple-500/25'
                            : 'bg-yellow-500 hover:bg-yellow-400 shadow-lg shadow-yellow-500/25',
                    )}
                >
                    {loading ? <Loader className="size-4 animate-spin" /> : `Upgrade to ${plan.name}`}
                </Button>
            ) : (
                <Button disabled variant="ghost" className="w-full bg-white/5 text-zinc-500 cursor-default rounded-xl">
                    Coming Soon
                </Button>
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

        <Button disabled variant="ghost" className="mt-5 w-full bg-white/5 text-zinc-600 cursor-default rounded-xl">
            {isCurrentPlan ? 'Current Plan' : 'Free'}
        </Button>
    </div>
);

// ── Cancel confirmation dialog ────────────────────────────────────────────────

const TIER_FEATURES: Record<string, string[]> = {
    PREMIUM: ['Host rooms up to 50 listeners', 'HD audio quality', 'Custom room themes', 'Priority support'],
    CREATOR: ['Unlimited room listeners', 'HD audio quality', 'Stream goal & donations', 'Analytics dashboard', 'Priority support'],
};

const CancelDialog = ({
    open,
    onClose,
    onConfirm,
    loading,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}) => {
    const { subStatus } = useSubscriptionStore();
    if (!subStatus) return null;

    const periodEnd = subStatus.currentPeriodEnd
        ? new Date(subStatus.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;
    const features = TIER_FEATURES[subStatus?.tier ?? ''] ?? [];
    const isYearly = subStatus?.billingCycle === 'yearly';

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-white">Cancel your {subStatus.tier} plan?</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {periodEnd
                            ? `You'll keep full access until ${periodEnd}. After that, your account reverts to Free.`
                            : 'Your account will revert to the Free plan at the end of the billing period.'}
                    </DialogDescription>
                </DialogHeader>

                {/* What you lose */}
                {features.length > 0 && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">You'll lose access to</p>
                        <ul className="space-y-1.5">
                            {features.map((f) => (
                                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                                    <X className="size-3.5 text-red-400 flex-shrink-0" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Yearly payment note */}
                {isYearly && (
                    <div className="flex gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                        <Info className="size-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-300 leading-relaxed">
                            Annual payments are non-refundable. You keep full {subStatus.tier} access until {periodEnd ?? 'your period ends'}, even after cancelling.
                        </p>
                    </div>
                )}

                {/* Plan change note */}
                <div className="flex gap-2.5 rounded-lg border border-white/10 bg-white/5 p-3">
                    <Info className="size-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Want to switch plans instead? You can subscribe to a new plan at any time — your current plan will be replaced immediately.
                    </p>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-end">
                    <Button variant="ghost" onClick={onClose} className="text-zinc-300 hover:text-white">
                        Keep my plan
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={loading}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                    >
                        {loading ? <Loader className="size-4 animate-spin mr-2" /> : null}
                        Confirm cancellation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ── Manage subscription banner ────────────────────────────────────────────────

const ManageBanner = () => {
    const { subStatus, manageLoading, cancelSubscription, reactivateSubscription } = useSubscriptionStore();
    const { userTier } = useWalletStore();
    const [showCancelDialog, setShowCancelDialog] = useState(false);

    // Fall back to wallet store tier if subStatus hasn't loaded yet
    const tier = subStatus?.tier ?? userTier;
    if (!tier || tier === 'FREE' || subStatus?.status === 'canceled') return null;
    // Synthesise a minimal subStatus if the API hasn't returned yet
    const resolvedStatus = subStatus ?? { tier, status: null, currentPeriodEnd: null, billingCycle: null, hasStripeSubscription: false };

    // Treat null status as active if user has a paid tier (webhook may not have fired yet)
    const effectiveStatus = resolvedStatus.status ?? 'active';

    const periodEnd = resolvedStatus.currentPeriodEnd
        ? new Date(resolvedStatus.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    const handleConfirmCancel = async () => {
        await cancelSubscription();
        setShowCancelDialog(false);
    };

    return (
        <>
            <div className={cn(
                'rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3',
                effectiveStatus === 'past_due'
                    ? 'border-red-500/30 bg-red-500/10'
                    : effectiveStatus === 'cancel_at_period_end'
                    ? 'border-yellow-500/30 bg-yellow-500/10'
                    : 'border-white/10 bg-white/5',
            )}>
                <div className="flex items-start gap-3">
                    {effectiveStatus === 'past_due' && <AlertTriangle className="size-4 text-red-400 mt-0.5 flex-shrink-0" />}
                    <div>
                        <p className="text-sm font-medium text-white">
                            {effectiveStatus === 'past_due' && 'Payment failed — please update your payment method'}
                            {effectiveStatus === 'cancel_at_period_end' && `${resolvedStatus.tier} plan cancels at period end`}
                            {effectiveStatus === 'active' && `Active ${resolvedStatus.tier} plan`}
                        </p>
                        {periodEnd && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                                {effectiveStatus === 'cancel_at_period_end' ? 'Full access until' : 'Renews'} {periodEnd}
                                {resolvedStatus.billingCycle === 'yearly' && ' · Annual billing'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    {effectiveStatus === 'cancel_at_period_end' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 gap-1.5"
                            disabled={manageLoading}
                            onClick={reactivateSubscription}
                        >
                            {manageLoading ? <Loader className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                            Reactivate
                        </Button>
                    )}
                    {effectiveStatus === 'active' && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                            disabled={manageLoading}
                            onClick={() => setShowCancelDialog(true)}
                        >
                            <X className="size-3" />
                            Cancel plan
                        </Button>
                    )}
                </div>
            </div>

            <CancelDialog
                open={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                onConfirm={handleConfirmCancel}
                loading={manageLoading}
            />
        </>
    );
};

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
