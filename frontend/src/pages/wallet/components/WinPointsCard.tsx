// WinPointsCard — WinPoints balance, activity gate (listener or creator), Stripe Connect, withdraw
import { useEffect, useState } from 'react'
import { Trophy, ExternalLink, CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp, ArrowDownToLine, AlertCircle, Radio, Users } from 'lucide-react'
import { useWalletStore } from '@/stores/useWalletStore'
import { WithdrawDialog } from './WithdrawDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Listener gate thresholds ──
const LISTENER_GATE = {
    roomsJoined:   5,
    gamesPlayed:   3,
    donationsMade: 1,
} as const

// ── Creator gate thresholds ──
const CREATOR_GATE = {
    streamHours:    2,   // total hours streamed (totalMinutesListened / 60)
    totalListeners: 10,  // total unique listener joins
} as const

interface GateRowProps { label: string; current: number; required: number; unit?: string }
const GateRow = ({ label, current, required, unit = '' }: GateRowProps) => {
    const done = current >= required
    return (
        <div className="flex items-center gap-3">
            {done
                ? <CheckCircle2 className="size-3.5 text-emerald-400 flex-shrink-0" />
                : <Clock className="size-3.5 text-zinc-600 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                    <span className={done ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span>
                    <span className={done ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                        {Math.min(current, required)}/{required}{unit}
                    </span>
                </div>
                <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', done ? 'bg-emerald-400' : 'bg-zinc-600')}
                        style={{ width: `${Math.min(100, (current / required) * 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

export const WinPointsCard = () => {
    const {
        winPoints, stripeConnectStatus, activityStats,
        connectStatus, connectLoading,
        fetchConnectStatus, onboardConnect,
    } = useWalletStore()

    const [expanded, setExpanded] = useState(false)
    const [withdrawOpen, setWithdrawOpen] = useState(false)

    useEffect(() => {
        if (expanded && !connectStatus && !connectLoading) {
            fetchConnectStatus()
        }
    }, [expanded, connectStatus, connectLoading, fetchConnectStatus])

    const wpBalance    = connectStatus?.winPoints ?? winPoints
    const feePercent   = connectStatus?.withdrawFeePercent   ?? 20
    const minWithdraw  = connectStatus?.minWithdrawWinPoints ?? 2000
    const wpToUsdCents = connectStatus?.winPointsToUsdCents  ?? 1
    const stats        = connectStatus?.activityStats        ?? activityStats
    const connectSt    = connectStatus?.stripeConnectStatus  ?? stripeConnectStatus
    const isCreator    = connectStatus?.isCreator ?? false
    const creatorStats = connectStatus?.creatorStats

    // ── Gate check ──
    const gateUnlocked = isCreator
        ? // Creator gate: stream hours + total listeners
          Math.floor((creatorStats?.totalMinutesListened ?? 0) / 60) >= CREATOR_GATE.streamHours &&
          (creatorStats?.totalStreams ?? 0) >= CREATOR_GATE.totalListeners
        : // Listener gate: rooms + games + donations
          (stats.roomsJoined   ?? 0) >= LISTENER_GATE.roomsJoined   &&
          (stats.gamesPlayed   ?? 0) >= LISTENER_GATE.gamesPlayed   &&
          (stats.donationsMade ?? 0) >= LISTENER_GATE.donationsMade

    const canWithdraw  = gateUnlocked && connectSt === 'active' && wpBalance >= minWithdraw

    const connectLabel =
        connectSt === 'active'      ? 'Connected'     :
        connectSt === 'pending'     ? 'Pending review':
        connectSt === 'restricted'  ? 'Restricted'    : 'Not connected'

    const connectColor =
        connectSt === 'active'      ? 'text-emerald-400' :
        connectSt === 'pending'     ? 'text-yellow-400'  :
        connectSt === 'restricted'  ? 'text-red-400'     : 'text-zinc-500'

    return (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
            {/* Header row — always visible */}
            <button
                className="w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent hover:from-emerald-600/15 transition-colors"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="bg-emerald-500/15 rounded-xl p-2.5 flex-shrink-0">
                    <Trophy className="size-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">WinPoints</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{wpBalance.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        ≈ ${((wpBalance * wpToUsdCents) / 100).toFixed(2)} · {isCreator ? 'earned from donations & streams' : 'earned from wins & streams'}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {canWithdraw && (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                            Ready to withdraw
                        </span>
                    )}
                    {expanded ? <ChevronUp className="size-4 text-zinc-500" /> : <ChevronDown className="size-4 text-zinc-500" />}
                </div>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-5 py-4 space-y-5 border-t border-white/10 bg-zinc-950/30">

                    {connectLoading && !connectStatus ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full bg-white/5" />
                            <Skeleton className="h-4 w-3/4 bg-white/5" />
                            <Skeleton className="h-4 w-1/2 bg-white/5" />
                        </div>
                    ) : (
                        <>
                            {/* Activity gate */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                            Activity Gate
                                        </p>
                                        <span className={cn(
                                            'text-[9px] font-semibold px-1.5 py-0.5 rounded-full border',
                                            isCreator
                                                ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                                                : 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                        )}>
                                            {isCreator ? 'Creator' : 'Listener'}
                                        </span>
                                    </div>
                                    {gateUnlocked
                                        ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="size-3" /> Unlocked</span>
                                        : <span className="text-[10px] text-zinc-600">Required to withdraw</span>
                                    }
                                </div>

                                <div className="space-y-3">
                                    {isCreator ? (
                                        <>
                                            <GateRow
                                                label="Hours streamed"
                                                current={Math.floor((creatorStats?.totalMinutesListened ?? 0) / 60)}
                                                required={CREATOR_GATE.streamHours}
                                                unit="h"
                                            />
                                            <GateRow
                                                label="Total listeners"
                                                current={creatorStats?.totalStreams ?? 0}
                                                required={CREATOR_GATE.totalListeners}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <GateRow label="Rooms joined"   current={stats.roomsJoined   ?? 0} required={LISTENER_GATE.roomsJoined}   />
                                            <GateRow label="Games played"   current={stats.gamesPlayed   ?? 0} required={LISTENER_GATE.gamesPlayed}   />
                                            <GateRow label="Donations made" current={stats.donationsMade ?? 0} required={LISTENER_GATE.donationsMade} />
                                        </>
                                    )}
                                </div>
                                {!gateUnlocked && (
                                    <p className="text-[11px] text-zinc-600 mt-2.5">
                                        {isCreator
                                            ? 'Host live rooms to accumulate stream hours and listeners.'
                                            : 'Join rooms, play minigames, and donate to unlock payouts.'
                                        }
                                    </p>
                                )}
                            </div>

                            {/* Stripe Connect */}
                            <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-zinc-300">Payout Account</p>
                                    <span className={cn('text-xs font-medium', connectColor)}>
                                        {connectLabel}
                                    </span>
                                </div>

                                {connectSt === 'active' ? (
                                    <p className="text-[11px] text-zinc-500">
                                        Stripe Connect is active. Withdrawals go directly to your bank.
                                    </p>
                                ) : connectSt === 'pending' ? (
                                    <p className="text-[11px] text-zinc-500">
                                        Your account is under review by Stripe. This usually takes 1–2 business days.
                                    </p>
                                ) : connectSt === 'restricted' ? (
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="size-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-red-400">
                                            Your Stripe account has restrictions. Reconnect to resolve issues.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-zinc-500">
                                        Connect a Stripe account to receive payouts from your WinPoints.
                                    </p>
                                )}

                                {(connectSt !== 'active' && connectSt !== 'pending') && (
                                    <button
                                        onClick={onboardConnect}
                                        disabled={connectLoading}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 rounded-xl transition-colors"
                                    >
                                        {connectLoading
                                            ? <Loader2 className="size-3.5 animate-spin" />
                                            : <ExternalLink className="size-3.5" />
                                        }
                                        {connectSt === 'restricted' ? 'Fix Stripe account' : 'Connect with Stripe'}
                                    </button>
                                )}
                            </div>

                            {/* Withdraw button */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400">Min: {minWithdraw.toLocaleString()} WP · Fee: {feePercent}%</p>
                                    {wpBalance < minWithdraw && (
                                        <p className="text-[11px] text-zinc-600 mt-0.5">
                                            Need {(minWithdraw - wpBalance).toLocaleString()} more WP to withdraw
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setWithdrawOpen(true)}
                                    disabled={!canWithdraw}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ArrowDownToLine className="size-3.5" />
                                    Withdraw
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {withdrawOpen && connectStatus && (
                <WithdrawDialog
                    open={withdrawOpen}
                    onOpenChange={setWithdrawOpen}
                    winPoints={wpBalance}
                    minWithdraw={minWithdraw}
                    feePercent={feePercent}
                    wpToUsdCents={wpToUsdCents}
                />
            )}
        </div>
    )
}
