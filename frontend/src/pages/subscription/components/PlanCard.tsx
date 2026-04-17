import { Check, Loader, Sparkles, Star, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { SubscriptionPlan } from '@/types/types'

const toDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export const TIER_META = {
    PREMIUM: {
        icon:       Star,
        gradient:   'from-purple-500/20 to-indigo-500/10',
        border:     'border-purple-500/30',
        ring:       'ring-purple-500/60',
        badgeBg:    'bg-purple-500',
        color:      'text-purple-400',
        checkColor: 'text-purple-400',
    },
    CREATOR: {
        icon:       Crown,
        gradient:   'from-yellow-500/15 to-orange-500/10',
        border:     'border-yellow-500/30',
        ring:       'ring-yellow-500/60',
        badgeBg:    'bg-yellow-500',
        color:      'text-yellow-400',
        checkColor: 'text-yellow-400',
    },
} as const

export const PlanCard = ({
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
    const meta = TIER_META[plan.tier as keyof typeof TIER_META]
    const PlanIcon = meta.icon

    const price = billingCycle === 'yearly' && plan.priceYearlyUsd
        ? plan.priceYearlyUsd / 12
        : plan.priceMonthlyUsd

    const yearlyTotal = plan.priceYearlyUsd ? toDollars(plan.priceYearlyUsd) : null

    const canSubscribe = billingCycle === 'yearly'
        ? plan.canSubscribeYearly
        : plan.canSubscribeMonthly

    const isPremium = plan.tier === 'PREMIUM'

    return (
        <div className={cn(
            'relative flex flex-col rounded-2xl border p-6 transition-all',
            'bg-gradient-to-br',
            meta.gradient,
            meta.border,
            isCurrentPlan && `ring-2 ${meta.ring}`,
        )}>
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

            <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>

            <div className="mb-1">
                <span className="text-3xl font-bold text-white">{toDollars(price)}</span>
                <span className="text-zinc-500 text-sm"> / mo</span>
            </div>

            {billingCycle === 'yearly' && yearlyTotal && (
                <p className="text-xs text-zinc-500 mb-4">{yearlyTotal} billed annually</p>
            )}

            <ul className="flex flex-col gap-2.5 my-5 flex-1">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check className={cn('size-4 mt-0.5 flex-shrink-0', meta.checkColor)} />
                        {f}
                    </li>
                ))}
            </ul>

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
    )
}
