import { useState } from 'react'
import { AlertTriangle, Loader, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSubscriptionStore } from '@/stores/useSubscriptionStore'
import { useWalletStore } from '@/stores/useWalletStore'
import { CancelDialog } from './CancelDialog'

export const ManageBanner = () => {
    const { subStatus, manageLoading, cancelSubscription, reactivateSubscription } = useSubscriptionStore()
    const { userTier } = useWalletStore()
    const [showCancelDialog, setShowCancelDialog] = useState(false)

    const tier = subStatus?.tier ?? userTier
    if (!tier || tier === 'FREE' || subStatus?.status === 'canceled') return null
    const resolvedStatus = subStatus ?? { tier, status: null, currentPeriodEnd: null, billingCycle: null, hasStripeSubscription: false }

    const effectiveStatus = resolvedStatus.status ?? 'active'

    const periodEnd = resolvedStatus.currentPeriodEnd
        ? new Date(resolvedStatus.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null

    const handleConfirmCancel = async () => {
        await cancelSubscription()
        setShowCancelDialog(false)
    }

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
    )
}
