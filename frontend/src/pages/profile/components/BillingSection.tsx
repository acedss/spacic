import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Loader, Clock, Zap, ArrowUpRight,
    Wallet, TrendingUp, TrendingDown, Crown, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { axiosInstance } from '@/lib/axios'
import { useWalletStore } from '@/stores/useWalletStore'
import type { Transaction } from '@/types/types'

interface SubStatus {
    tier: string;
    status: 'active' | 'past_due' | 'cancel_at_period_end' | 'canceled' | null;
    currentPeriodEnd: string | null;
    hasActiveSubscription: boolean;
}

const TIER_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    FREE:    { label: 'Free',    color: 'bg-zinc-700/60 text-zinc-300',     icon: Zap   },
    PREMIUM: { label: 'Premium', color: 'bg-purple-500/80 text-white',      icon: Star  },
    CREATOR: { label: 'Creator', color: 'bg-yellow-500/80 text-black',      icon: Crown },
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatAmount = (tx: Transaction) => {
    const sign = tx.type === 'topup' || tx.type === 'goal_payout' ? '+' : '-'
    return `${sign}${Math.abs(tx.amount).toLocaleString()}`
}

const txColor = (tx: Transaction) =>
    tx.type === 'topup' || tx.type === 'goal_payout' ? 'text-green-400' : 'text-red-400'

const txLabel = (tx: Transaction) => {
    if (tx.type === 'topup') return 'Wallet top-up'
    if (tx.type === 'goal_payout') return `Goal payout${tx.roomId ? ` · ${tx.roomId.title}` : ''}`
    return `Donation${tx.roomId ? ` · ${tx.roomId.title}` : ''}`
}

export const BillingSection = () => {
    const { balance, userTier, transactions, loading, hasFetched, fetchWallet } = useWalletStore()
    const navigate = useNavigate()

    const [sub, setSub] = useState<SubStatus | null>(null)
    const [subLoading, setSubLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => { if (!hasFetched) fetchWallet() }, [hasFetched, fetchWallet])

    useEffect(() => {
        axiosInstance.get('/subscriptions/status')
            .then(({ data }) => setSub(data.data))
            .catch(() => { })
            .finally(() => setSubLoading(false))
    }, [])

    const handleCancel = async () => {
        if (!confirm('Cancel your subscription? You keep access until the end of your billing period.')) return
        setActionLoading(true)
        try {
            const { data } = await axiosInstance.delete('/subscriptions/cancel')
            setSub((prev) => prev ? { ...prev, status: 'cancel_at_period_end', currentPeriodEnd: data.data.currentPeriodEnd } : prev)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            alert(msg ?? 'Failed to cancel subscription')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReactivate = async () => {
        setActionLoading(true)
        try {
            await axiosInstance.post('/subscriptions/reactivate')
            setSub((prev) => prev ? { ...prev, status: 'active' } : prev)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            alert(msg ?? 'Failed to reactivate subscription')
        } finally {
            setActionLoading(false)
        }
    }

    const tier = TIER_META[userTier] ?? TIER_META.FREE
    const TierIcon = tier.icon
    const recentTxs = transactions.slice(0, 5)
    const periodEndLabel = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null

    return (
        <div className="space-y-6 max-w-2xl">
            {sub?.status === 'past_due' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="size-4 text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-red-300">Payment failed</p>
                        <p className="text-xs text-red-400/80 mt-0.5">
                            We couldn't charge your card. Stripe will retry automatically. Update your payment method to avoid losing access.
                        </p>
                    </div>
                </div>
            )}

            {sub?.status === 'cancel_at_period_end' && periodEndLabel && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="size-4 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-300">Cancellation scheduled</p>
                        <p className="text-xs text-yellow-400/80 mt-0.5">
                            You still have full access until <span className="font-semibold text-yellow-300">{periodEndLabel}</span>. Changed your mind?
                        </p>
                    </div>
                    <Button
                        size="sm"
                        disabled={actionLoading}
                        onClick={handleReactivate}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold shrink-0"
                    >
                        {actionLoading ? <Loader className="size-3.5 animate-spin" /> : 'Reactivate'}
                    </Button>
                </div>
            )}

            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Current Plan</h3>
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                                <TierIcon className="size-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{tier.label}</span>
                                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', tier.color)}>
                                        {tier.label.toUpperCase()}
                                    </span>
                                </div>
                                {subLoading ? (
                                    <div className="h-3 w-32 bg-white/10 rounded animate-pulse mt-1" />
                                ) : (
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {userTier === 'FREE' && 'Basic access to all public rooms'}
                                        {sub?.status === 'active' && periodEndLabel && `Renews ${periodEndLabel}`}
                                        {sub?.status === 'cancel_at_period_end' && periodEndLabel && `Access until ${periodEndLabel}`}
                                        {sub?.status === 'past_due' && 'Payment past due — update payment method'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {sub?.status === 'active' && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={actionLoading}
                                    onClick={handleCancel}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                                >
                                    {actionLoading ? <Loader className="size-3.5 animate-spin" /> : 'Cancel'}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-zinc-900 hover:text-white hover:bg-white/5"
                                onClick={() => navigate('/subscription')}
                            >
                                {userTier === 'FREE' ? 'Upgrade' : 'Change plan'}
                                <ArrowUpRight className="size-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Separator className="bg-white/10" />

            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Wallet</h3>
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <Wallet className="size-5 text-yellow-400" />
                        </div>
                        <div>
                            {loading ? (
                                <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                            ) : (
                                <p className="text-lg font-bold text-yellow-400">
                                    {balance.toLocaleString()} <span className="text-xs font-normal text-zinc-500">coins</span>
                                </p>
                            )}
                            <p className="text-xs text-zinc-500 mt-0.5">Available balance</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold shrink-0"
                        onClick={() => navigate('/wallet')}
                    >
                        Top Up
                    </Button>
                </div>
            </div>

            {recentTxs.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
                        <button
                            onClick={() => navigate('/wallet')}
                            className="text-xs text-zinc-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                        >
                            View all <ArrowUpRight className="size-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentTxs.map((tx) => (
                            <div key={tx._id} className="flex items-center justify-between py-2.5 px-3 bg-zinc-900 border border-white/10 rounded-lg">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        'size-7 rounded-full flex items-center justify-center shrink-0',
                                        tx.type === 'topup' || tx.type === 'goal_payout' ? 'bg-green-500/10' : 'bg-red-500/10',
                                    )}>
                                        {tx.type === 'topup' || tx.type === 'goal_payout'
                                            ? <TrendingUp className="size-3.5 text-green-400" />
                                            : <TrendingDown className="size-3.5 text-red-400" />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{txLabel(tx)}</p>
                                        <p className="text-[10px] text-zinc-600">{formatDate(tx.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={cn('text-sm font-semibold shrink-0 ml-2', txColor(tx))}>
                                    {formatAmount(tx)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
