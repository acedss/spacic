// CreateGameDialog — inline minigame creation while live
// Validates creator balance before submitting (coinReward is debited from creator)
import { useState } from 'react'
import { Gamepad2, Loader2, CheckCircle2 } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMinigame } from '@/lib/minigameService'
import { cn } from '@/lib/utils'
import type { Minigame, MinigameType } from '@/types/types'
import { toast } from 'sonner'
import { useWalletStore } from '@/stores/useWalletStore'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    roomId: string
    creatorBalance: number
    onCreated: (game: Minigame) => void
}

const GAME_TYPES: { value: MinigameType; label: string; desc: string }[] = [
    { value: 'song_guesser', label: 'Song Guesser',  desc: 'Listeners guess the song title' },
    { value: 'lyric_fill',   label: 'Lyric Fill-in', desc: 'Complete the missing lyric word' },
    { value: 'trivia',       label: 'Trivia',         desc: 'A/B/C/D multiple choice question' },
    { value: 'skip_battle',  label: 'Skip Battle',    desc: 'Vote to skip the current song' },
]

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const REWARD_OPTIONS   = [0, 50, 100, 200, 500, 1000]
const OPTION_LABELS    = ['A', 'B', 'C', 'D']

export const CreateGameDialog = ({ open, onOpenChange, roomId, creatorBalance, onCreated }: Props) => {
    const [type, setType]               = useState<MinigameType>('song_guesser')
    const [title, setTitle]             = useState('')
    const [durationSeconds, setDuration] = useState(30)
    const [coinReward, setCoinReward]    = useState(0)
    const [question, setQuestion]        = useState('')
    const [answer, setAnswer]            = useState('')
    const [lyric, setLyric]              = useState('')
    const [options, setOptions]          = useState(['', '', '', ''])
    const [correctOption, setCorrectOption] = useState(0)
    const [saving, setSaving]            = useState(false)

    const rewardTooHigh = coinReward > creatorBalance

    const setOption = (idx: number, val: string) =>
        setOptions(prev => prev.map((o, i) => i === idx ? val : o))

    const reset = () => {
        setType('song_guesser'); setTitle(''); setDuration(30)
        setCoinReward(0); setQuestion(''); setAnswer(''); setLyric('')
        setOptions(['', '', '', '']); setCorrectOption(0)
    }

    const validate = () => {
        if (!title.trim()) { toast.error('Give the game a title'); return false }
        if (rewardTooHigh) { toast.error('Reward exceeds your coin balance'); return false }
        if (type === 'trivia') {
            if (!question.trim()) { toast.error('Trivia needs a question'); return false }
            if (options.some(o => !o.trim())) { toast.error('Fill in all 4 answer options'); return false }
        }
        if (type === 'lyric_fill' && !lyric.trim()) { toast.error('Enter the lyric with a blank'); return false }
        if ((type === 'song_guesser' || type === 'lyric_fill') && !answer.trim()) {
            toast.error('Enter the correct answer'); return false
        }
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        setSaving(true)
        try {
            const config = (() => {
                switch (type) {
                    case 'trivia':      return { question: question.trim(), options, correctOption }
                    case 'lyric_fill':  return { lyric: lyric.trim(), answer: answer.trim() }
                    case 'song_guesser': return { answer: answer.trim() }
                    default:            return {}
                }
            })()

            const game = await createMinigame(roomId, {
                type, title: title.trim(), durationSeconds, coinReward,
                trigger: { type: 'manual', songIndex: null },
                config,
            })
            onCreated(game)
            onOpenChange(false)
            reset()
            toast.success('Game created — trigger it from the panel when ready')
            useWalletStore.getState().fetchWallet()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create game')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!saving) { onOpenChange(v); if (!v) reset() } }}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Gamepad2 className="size-4 text-violet-400" /> New Minigame
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Type selector */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Game type</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {GAME_TYPES.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setType(t.value)}
                                    className={cn(
                                        'px-3 py-2.5 rounded-lg text-left transition',
                                        type === t.value
                                            ? 'bg-violet-600/20 border border-violet-500 text-white'
                                            : 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10',
                                    )}
                                >
                                    <p className="text-xs font-semibold">{t.label}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</p>
                                </button>
                            ))}
                        </div>
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

                    {/* ── Trivia: question + A/B/C/D options ── */}
                    {type === 'trivia' && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-400">Question</Label>
                                <Input
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    placeholder="What year was this song released?"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-zinc-400">Answer options — click the correct one</Label>
                                {options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCorrectOption(idx)}
                                            aria-label={`Mark option ${OPTION_LABELS[idx]} as correct answer`}
                                            aria-pressed={correctOption === idx}
                                            className={cn(
                                                'size-7 rounded-lg text-xs font-bold shrink-0 transition border',
                                                correctOption === idx
                                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10',
                                            )}
                                        >
                                            {OPTION_LABELS[idx]}
                                        </button>
                                        <Input
                                            value={opt}
                                            onChange={e => setOption(idx, e.target.value)}
                                            placeholder={`Option ${OPTION_LABELS[idx]}`}
                                            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                                        />
                                        {correctOption === idx && (
                                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                        )}
                                    </div>
                                ))}
                                <p className="text-[10px] text-zinc-600">Click a letter button to mark the correct answer</p>
                            </div>
                        </>
                    )}

                    {/* ── Lyric Fill-in ── */}
                    {type === 'lyric_fill' && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Lyric with blank (use ___ for the missing word)</Label>
                            <Input
                                value={lyric}
                                onChange={e => setLyric(e.target.value)}
                                placeholder='She said ___ and then she left'
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                            />
                        </div>
                    )}

                    {/* ── Correct answer: song_guesser + lyric_fill ── */}
                    {(type === 'song_guesser' || type === 'lyric_fill') && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">
                                Correct answer {type === 'song_guesser' ? '(song title or artist)' : '(fill-in word)'}
                            </Label>
                            <Input
                                value={answer}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder={type === 'song_guesser' ? 'e.g. Blinding Lights' : 'e.g. love'}
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                            />
                        </div>
                    )}

                    {/* ── Skip Battle: no config needed ── */}
                    {type === 'skip_battle' && (
                        <p className="text-xs text-zinc-500 bg-white/3 rounded-lg px-3 py-2.5">
                            Listeners vote to skip the current song. Most votes in the time limit wins — no answer needed.
                        </p>
                    )}

                    {/* Duration + reward */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Duration</Label>
                            <select
                                value={durationSeconds}
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full px-3 py-2 h-9 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                            >
                                {DURATION_OPTIONS.map(d => (
                                    <option key={d} value={d}>{d}s</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">
                                Prize (coins)
                                {rewardTooHigh && <span className="ml-1 text-red-400">low balance</span>}
                            </Label>
                            <select
                                value={coinReward}
                                onChange={e => setCoinReward(Number(e.target.value))}
                                className={cn(
                                    'w-full px-3 py-2 h-9 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500',
                                    rewardTooHigh ? 'border-red-500/50' : 'border-white/10'
                                )}
                            >
                                {REWARD_OPTIONS.map(r => (
                                    <option key={r} value={r}>{r === 0 ? 'No prize' : `${r} 🪙`}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {coinReward > 0 && (
                        <p className="text-[11px] text-zinc-500 bg-white/3 rounded-lg px-3 py-2">
                            {coinReward} coins deducted from your balance now. Winner gets {coinReward} WinPoints. No winner → full refund.
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
