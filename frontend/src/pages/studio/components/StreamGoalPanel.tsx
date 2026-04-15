// StreamGoalPanel — shows donation progress with inline goal edit via Popover
import { useState } from 'react'
import { Target, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { updateQueueWhileLive } from '@/lib/roomService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
    roomId: string
    streamGoal: number       // 0 = no goal
    streamGoalCurrent: number
    onGoalChanged: (newGoal: number) => void
}

export const StreamGoalPanel = ({ roomId, streamGoal, streamGoalCurrent, onGoalChanged }: Props) => {
    const [popoverOpen, setPopoverOpen] = useState(false)
    const [goalInput, setGoalInput]     = useState(String(streamGoal || ''))
    const [saving, setSaving]           = useState(false)

    const percent = streamGoal > 0 ? Math.min(100, (streamGoalCurrent / streamGoal) * 100) : 0
    const hasGoal = streamGoal > 0

    const handleSave = async () => {
        const val = parseInt(goalInput, 10)
        if (isNaN(val) || val < 0) { toast.error('Enter a valid amount (0 to remove goal)'); return }
        setSaving(true)
        try {
            await updateQueueWhileLive(roomId, { streamGoal: val })
            onGoalChanged(val)
            setPopoverOpen(false)
            toast.success(val === 0 ? 'Goal removed' : `Goal set to ${val.toLocaleString()} coins`)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update goal')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Target className="size-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-zinc-300">Stream Goal</span>
                </div>

                <Popover open={popoverOpen} onOpenChange={v => { setPopoverOpen(v); if (v) setGoalInput(String(streamGoal || '')) }}>
                    <PopoverTrigger asChild>
                        <button className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
                            <Pencil className="size-3.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-64 bg-zinc-900 border-white/10 p-3 space-y-2">
                        <p className="text-xs text-zinc-400 font-medium">Set donation goal (coins)</p>
                        <p className="text-[11px] text-zinc-600">Set to 0 to remove the goal</p>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min={0}
                                value={goalInput}
                                onChange={e => setGoalInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                                placeholder="e.g. 1000"
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-8 text-sm flex-1"
                                autoFocus
                            />
                            <button onClick={handleSave} disabled={saving}
                                className="p-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors">
                                {saving ? <Loader2 className="size-3.5 animate-spin text-white" /> : <Check className="size-3.5 text-white" />}
                            </button>
                            <button onClick={() => setPopoverOpen(false)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="size-3.5 text-zinc-400" />
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {hasGoal ? (
                <>
                    <div className="flex items-end justify-between text-xs">
                        <span className="text-white font-bold tabular-nums">{streamGoalCurrent.toLocaleString()}</span>
                        <span className="text-zinc-500">of {streamGoal.toLocaleString()} 🪙</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-700',
                                percent >= 100 ? 'bg-emerald-400' : 'bg-yellow-400'
                            )}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-zinc-500 text-right">
                        {percent >= 100 ? '🎉 Goal reached!' : `${Math.round(percent)}% — ${(streamGoal - streamGoalCurrent).toLocaleString()} to go`}
                    </p>
                </>
            ) : (
                <p className="text-xs text-zinc-600 text-center py-2">
                    No goal set — click <Pencil className="size-3 inline" /> to add one
                </p>
            )}
        </div>
    )
}
