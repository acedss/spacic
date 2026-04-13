import { cn } from '@/lib/utils'
import { ArrowUpRight, Heart, Trophy } from 'lucide-react'
import type { Transaction } from '@/types/types'

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const toCoins = (credits: number) => `${credits.toLocaleString()} coins`

export const TX_META = {
    topup:       { bg: 'bg-emerald-500/15', icon: ArrowUpRight, iconColor: 'text-emerald-400', amountColor: 'text-emerald-400', sign: '+', label: () => 'Wallet Top-up' },
    donation:    { bg: 'bg-pink-500/15',    icon: Heart,         iconColor: 'text-pink-400',    amountColor: 'text-pink-400',    sign: '−', label: (tx: Transaction) => `Donated to "${tx.roomId?.title ?? 'a room'}"` },
    goal_payout: { bg: 'bg-yellow-500/15',  icon: Trophy,        iconColor: 'text-yellow-400',  amountColor: 'text-yellow-400',  sign: '+', label: (tx: Transaction) => `Goal payout from "${tx.roomId?.title ?? 'a room'}"` },
} as const

export const TransactionRow = ({ tx }: { tx: Transaction }) => {
    const meta = TX_META[tx.type as keyof typeof TX_META] ?? TX_META.topup
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
                {meta.sign}{toCoins(tx.amount)}
            </span>
        </div>
    )
}
