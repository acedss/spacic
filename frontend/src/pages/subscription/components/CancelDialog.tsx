import { Loader, X, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useSubscriptionStore } from '@/stores/useSubscriptionStore'

const TIER_FEATURES: Record<string, string[]> = {
    PREMIUM: ['Host rooms up to 50 listeners', 'HD audio quality', 'Custom room themes', 'Priority support'],
    CREATOR: ['Unlimited room listeners', 'HD audio quality', 'Stream goal & donations', 'Analytics dashboard', 'Priority support'],
}

export const CancelDialog = ({
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
    const { subStatus } = useSubscriptionStore()
    if (!subStatus) return null

    const periodEnd = subStatus.currentPeriodEnd
        ? new Date(subStatus.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null
    const features = TIER_FEATURES[subStatus?.tier ?? ''] ?? []
    const isYearly = subStatus?.billingCycle === 'yearly'

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

                {isYearly && (
                    <div className="flex gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                        <Info className="size-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-300 leading-relaxed">
                            Annual payments are non-refundable. You keep full {subStatus.tier} access until {periodEnd ?? 'your period ends'}, even after cancelling.
                        </p>
                    </div>
                )}

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
    )
}
