// WithdrawDialog — validates 2000wp minimum, shows fee breakdown, submits withdrawal
import { useState } from 'react'
import { Loader2, ArrowDownToLine, AlertCircle } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWalletStore } from '@/stores/useWalletStore'
import { toast } from 'sonner'

interface Props {
    open:          boolean
    onOpenChange:  (open: boolean) => void
    winPoints:     number
    minWithdraw:   number   // e.g. 2000
    feePercent:    number   // e.g. 20
    wpToUsdCents:  number   // e.g. 1 (1 WP = $0.01)
}

export const WithdrawDialog = ({
    open, onOpenChange, winPoints, minWithdraw, feePercent, wpToUsdCents,
}: Props) => {
    const [amountInput, setAmountInput] = useState(String(minWithdraw))
    const { withdrawWinPoints, withdrawLoading } = useWalletStore()

    const amount       = parseInt(amountInput, 10) || 0
    const grossCents   = amount * wpToUsdCents
    const feeCents     = Math.round(grossCents * feePercent / 100)
    const netCents     = grossCents - feeCents
    const grossUsd     = (grossCents / 100).toFixed(2)
    const feeUsd       = (feeCents   / 100).toFixed(2)
    const netUsd       = (netCents   / 100).toFixed(2)

    const tooLow       = amount < minWithdraw
    const notEnough    = amount > winPoints
    const belowOneDollar = netCents < 100 && amount > 0
    const hasError     = tooLow || notEnough || belowOneDollar

    const errorMsg = notEnough
        ? `You only have ${winPoints.toLocaleString()} WP`
        : tooLow
            ? `Minimum is ${minWithdraw.toLocaleString()} WP ($${(minWithdraw * wpToUsdCents / 100).toFixed(2)})`
            : belowOneDollar
                ? 'Net payout would be less than $1.00 after fees'
                : null

    const handleSubmit = async () => {
        if (hasError || !amount) return
        try {
            const result = await withdrawWinPoints(amount)
            toast.success(`Withdrawal submitted! Net payout: $${result.netUsd}`, {
                description: 'Funds typically arrive within 2 business days',
                duration: 8000,
            })
            onOpenChange(false)
        } catch {
            // error already toasted in store
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!withdrawLoading) onOpenChange(v) }}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <ArrowDownToLine className="size-4 text-emerald-400" />
                        Withdraw WinPoints
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">
                            Amount (WP) · {winPoints.toLocaleString()} available
                        </Label>
                        <Input
                            type="number"
                            min={minWithdraw}
                            max={winPoints}
                            step={100}
                            value={amountInput}
                            onChange={e => setAmountInput(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-10"
                        />
                        {errorMsg && (
                            <p className="flex items-center gap-1.5 text-xs text-red-400">
                                <AlertCircle className="size-3 flex-shrink-0" />
                                {errorMsg}
                            </p>
                        )}
                    </div>

                    {/* Fee breakdown */}
                    {amount > 0 && !tooLow && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between text-zinc-400">
                                <span>Gross ({amount.toLocaleString()} WP × ${(wpToUsdCents / 100).toFixed(2)})</span>
                                <span className="text-white font-medium">${grossUsd}</span>
                            </div>
                            <div className="flex justify-between text-zinc-500">
                                <span>Platform fee ({feePercent}%)</span>
                                <span className="text-red-400">−${feeUsd}</span>
                            </div>
                            <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                                <span className="text-zinc-200">You receive</span>
                                <span className={netCents < 100 ? 'text-red-400' : 'text-emerald-400'}>
                                    ${netUsd}
                                </span>
                            </div>
                        </div>
                    )}

                    <p className="text-[11px] text-zinc-600">
                        Sent to your connected Stripe account. Typically arrives in 2 business days.
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={withdrawLoading} className="text-zinc-400">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={withdrawLoading || hasError || !amount}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        {withdrawLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                        Withdraw ${netUsd}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
