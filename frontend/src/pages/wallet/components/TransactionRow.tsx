import { cn } from '@/lib/utils'
import { ArrowUpRight, Heart, Trophy, Gamepad2, RotateCcw, Mic, ArrowDownToLine, Receipt } from 'lucide-react'
import type { Transaction } from '@/types/types'

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const TX_META: Record<string, {
    bg: string; icon: React.ElementType; iconColor: string; amountColor: string
    sign: string; currency: 'coins' | 'wp'; label: (tx: Transaction) => string
}> = {
    topup: {
        bg: 'bg-emerald-500/15', icon: ArrowUpRight, iconColor: 'text-emerald-400', amountColor: 'text-emerald-400',
        sign: '+', currency: 'coins',
        label: () => 'Wallet Top-up',
    },
    donation: {
        bg: 'bg-pink-500/15', icon: Heart, iconColor: 'text-pink-400', amountColor: 'text-pink-400',
        sign: '−', currency: 'coins',
        label: (tx) => `Donated to "${tx.roomId?.title ?? 'a room'}"`,
    },
    goal_payout: {
        bg: 'bg-yellow-500/15', icon: Trophy, iconColor: 'text-yellow-400', amountColor: 'text-yellow-400',
        sign: '+', currency: 'wp',
        label: (tx) => `Stream earnings from "${tx.roomId?.title ?? 'a room'}"`,
    },
    minigame_debit: {
        bg: 'bg-orange-500/15', icon: Gamepad2, iconColor: 'text-orange-400', amountColor: 'text-orange-400',
        sign: '−', currency: 'coins',
        label: () => 'Minigame prize funded',
    },
    minigame_win: {
        bg: 'bg-violet-500/15', icon: Gamepad2, iconColor: 'text-violet-400', amountColor: 'text-violet-400',
        sign: '+', currency: 'wp',
        label: () => 'Minigame win',
    },
    minigame_refund: {
        bg: 'bg-zinc-500/15', icon: RotateCcw, iconColor: 'text-zinc-400', amountColor: 'text-zinc-300',
        sign: '+', currency: 'coins',
        label: () => 'Minigame prize refund (no winner)',
    },
    creator_earning: {
        bg: 'bg-teal-500/15', icon: Mic, iconColor: 'text-teal-400', amountColor: 'text-teal-400',
        sign: '+', currency: 'wp',
        label: (tx) => `Creator earnings from "${tx.roomId?.title ?? 'stream'}"`,
    },
    withdrawal: {
        bg: 'bg-blue-500/15', icon: ArrowDownToLine, iconColor: 'text-blue-400', amountColor: 'text-blue-400',
        sign: '−', currency: 'wp',
        label: () => 'WinPoints withdrawal',
    },
    withdrawal_fee: {
        bg: 'bg-zinc-500/15', icon: Receipt, iconColor: 'text-zinc-500', amountColor: 'text-zinc-500',
        sign: '−', currency: 'wp',
        label: () => 'Platform fee',
    },
}

const currencyLabel = (amount: number, currency: 'coins' | 'wp') =>
    currency === 'wp'
        ? `${amount.toLocaleString()} WP`
        : `${amount.toLocaleString()} 🪙`

export const TransactionRow = ({ tx }: { tx: Transaction }) => {
    const meta = TX_META[tx.type] ?? TX_META.topup
    const Icon = meta.icon
    return (
        <div className="flex items-center gap-3 py-3.5 border-b border-white/5 last:border-0">
            <div className={cn('size-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                <Icon className={cn('size-4', meta.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{meta.label(tx)}</p>
                <p className="text-xs text-zinc-500">{formatDate(tx.createdAt)}</p>
            </div>
            <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', meta.amountColor)}>
                {meta.sign}{currencyLabel(tx.amount, meta.currency)}
            </span>
        </div>
    )
}
