// CreateGameDialog — inline minigame creation while live
// Validates creator balance before submitting (coinReward is debited from creator)
import { useState } from 'react'
import { Gamepad2, Loader2 } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createMinigame } from '@/lib/minigameService'
import type { Minigame, MinigameType } from '@/types/types'
import { toast } from 'sonner'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    roomId: string
    creatorBalance: number // current coin balance — validate coinReward ≤ balance
    onCreated: (game: Minigame) => void
}

const GAME_TYPES: { value: MinigameType; label: string; hasQuestion: boolean; hasLyric: boolean }[] = [
    { value: 'song_guesser', label: 'Song Guesser', hasQuestion: false, hasLyric: false },
    { value: 'lyric_fill',   label: 'Lyric Fill-in', hasQuestion: false, hasLyric: true },
    { value: 'trivia',       label: 'Trivia',         hasQuestion: true, hasLyric: false },
    { value: 'skip_battle',  label: 'Skip Battle',    hasQuestion: false, hasLyric: false },
]

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const REWARD_OPTIONS   = [0, 50, 100, 200, 500, 1000]

export const CreateGameDialog = ({ open, onOpenChange, roomId, creatorBalance, onCreated }: Props) => {
    const [type, setType]               = useState<MinigameType>('song_guesser')
    const [title, setTitle]             = useState('')
    const [durationSeconds, setDuration] = useState(30)
    const [coinReward, setCoinReward]    = useState(0)
    const [question, setQuestion]        = useState('')
    const [answer, setAnswer]            = useState('')
    const [lyric, setLyric]              = useState('')
    const [saving, setSaving]            = useState(false)

    const selectedType = GAME_TYPES.find(t => t.value === type)!
    const rewardTooHigh = coinReward > creatorBalance

    const reset = () => {
        setType('song_guesser'); setTitle(''); setDuration(30)
        setCoinReward(0); setQuestion(''); setAnswer(''); setLyric('')
    }

    const handleSubmit = async () => {
        if (!title.trim()) { toast.error('Give the game a title'); return }
        if (rewardTooHigh) { toast.error('Reward exceeds your coin balance'); return }

        setSaving(true)
        try {
            const game = await createMinigame(roomId, {
                type,
                title: title.trim(),
                durationSeconds,
                coinReward,
                trigger: { type: 'manual', songIndex: null },
                config: {
                    question:  selectedType.hasQuestion ? question.trim() || null : null,
                    answer:    selectedType.hasQuestion ? answer.trim()   || null : null,
                    lyric:     selectedType.hasLyric   ? lyric.trim()    || null : null,
                },
            })
            onCreated(game)
            onOpenChange(false)
            reset()
            toast.success('Game created — trigger it from the panel when ready')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create game')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!saving) { onOpenChange(v); if (!v) reset() } }}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Gamepad2 className="size-4 text-violet-400" /> New Minigame
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Type */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Game type</Label>
                        <Select value={type} onValueChange={v => setType(v as MinigameType)}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                                {GAME_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value} className="text-white focus:bg-white/10">
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Title</Label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Guess this beat!"
                            maxLength={60}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                        />
                    </div>

                    {/* Trivia question + answer */}
                    {selectedType.hasQuestion && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-400">Question</Label>
                                <Input value={question} onChange={e => setQuestion(e.target.value)}
                                    placeholder="What year was this song released?"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-400">Correct answer</Label>
                                <Input value={answer} onChange={e => setAnswer(e.target.value)}
                                    placeholder="2019"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9" />
                            </div>
                        </>
                    )}

                    {/* Lyric fill */}
                    {selectedType.hasLyric && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Lyric (listeners fill the blank)</Label>
                            <Input value={lyric} onChange={e => setLyric(e.target.value)}
                                placeholder="She said ___ and then she left"
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9" />
                        </div>
                    )}

                    {/* Duration + reward row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Duration</Label>
                            <Select value={String(durationSeconds)} onValueChange={v => setDuration(Number(v))}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10">
                                    {DURATION_OPTIONS.map(d => (
                                        <SelectItem key={d} value={String(d)} className="text-white focus:bg-white/10">{d}s</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">
                                Prize (coins)
                                {rewardTooHigh && <span className="ml-1 text-red-400">low balance</span>}
                            </Label>
                            <Select value={String(coinReward)} onValueChange={v => setCoinReward(Number(v))}>
                                <SelectTrigger className={`bg-white/5 border-white/10 text-white h-9 ${rewardTooHigh ? 'border-red-500/50' : ''}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10">
                                    {REWARD_OPTIONS.map(r => (
                                        <SelectItem key={r} value={String(r)} className="text-white focus:bg-white/10">
                                            {r === 0 ? 'No prize' : `${r} 🪙`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {coinReward > 0 && (
                        <p className="text-[11px] text-zinc-500 bg-white/3 rounded-lg px-3 py-2">
                            {coinReward} coins will be deducted from your balance now. Winner gets {coinReward} WinPoints. No winner → refund.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="text-zinc-400">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving || rewardTooHigh} className="bg-violet-600 hover:bg-violet-500 text-white">
                        {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
