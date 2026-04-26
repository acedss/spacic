// ListenerGamePanel — shown to listeners when an active minigame is running.
// Renders a different answer UI per game type:
//   trivia       → A/B/C/D option buttons (submits index as string)
//   song_guesser → free-text input
//   lyric_fill   → free-text input with lyric prompt
//   skip_battle  → single "Vote to Skip" button (no answer)
import { useState, useEffect } from 'react'
import { Trophy, Clock, Gamepad2, Send, Zap } from 'lucide-react'
import { useRoomStore } from '@/stores/useRoomStore'
import { useRoomSession } from '@/providers/RoomSessionProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { MinigameType } from '@/types/types'

const GAME_LABELS: Record<MinigameType, string> = {
    song_guesser: 'Song Guesser',
    lyric_fill:   'Lyric Fill-In',
    trivia:       'Trivia',
    skip_battle:  'Skip Battle',
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_COLORS = [
    'bg-violet-600/20 border-violet-500/40 hover:bg-violet-600/40 text-violet-200',
    'bg-blue-600/20   border-blue-500/40   hover:bg-blue-600/40   text-blue-200',
    'bg-amber-600/20  border-amber-500/40  hover:bg-amber-600/40  text-amber-200',
    'bg-emerald-600/20 border-emerald-500/40 hover:bg-emerald-600/40 text-emerald-200',
]

export const ListenerGamePanel = () => {
    const { activeGame, gameSecondsLeft } = useRoomStore()
    const { submitAnswer } = useRoomSession()

    const [textAnswer, setTextAnswer]   = useState('')
    const [submitted, setSubmitted]     = useState(false)
    const [selectedOpt, setSelectedOpt] = useState<number | null>(null)

    const gameId = activeGame?.minigameId

    useEffect(() => {
        setTextAnswer('')
        setSubmitted(false)
        setSelectedOpt(null)
    }, [gameId])

    if (!gameId || !activeGame) return null

    const isExpired = gameSecondsLeft === 0
    const urgentTime = gameSecondsLeft <= 5

    const submitText = () => {
        if (!textAnswer.trim() || submitted) return
        submitAnswer(activeGame.minigameId, textAnswer.trim())
        setSubmitted(true)
    }

    const submitOption = (idx: number) => {
        if (submitted) return
        setSelectedOpt(idx)
        submitAnswer(activeGame.minigameId, String(idx))
        setSubmitted(true)
    }

    const submitVote = () => {
        if (submitted) return
        submitAnswer(activeGame.minigameId, 'skip')
        setSubmitted(true)
    }

    return (
        <div
            key={gameId}
            className={cn(
                'fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm',
                'bottom-[calc(13rem+env(safe-area-inset-bottom))]',
                'bg-violet-950/95 backdrop-blur-md border rounded-2xl shadow-2xl p-4',
                'border-violet-500/30 animate-in slide-in-from-bottom-4 duration-300',
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <Gamepad2 className="size-3.5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold leading-none">
                            {GAME_LABELS[activeGame.type]}
                        </p>
                        {activeGame.coinReward > 0 && (
                            <p className="text-xs text-white font-semibold leading-tight mt-0.5">
                                {activeGame.coinReward.toLocaleString()} 🪙 prize
                            </p>
                        )}
                    </div>
                </div>

                <div className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums',
                    urgentTime ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/10 text-zinc-300',
                )}>
                    <Clock className="size-3" />
                    {gameSecondsLeft}s
                </div>
            </div>

            {/* Title always shown */}
            <p className="text-sm font-semibold text-white mb-2 leading-snug">{activeGame.title}</p>

            {/* ── Submitted state ── */}
            {submitted ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
                    <Trophy className="size-3.5 text-green-400 shrink-0" />
                    <p className="text-xs text-green-300">
                        {activeGame.type === 'skip_battle' ? 'Vote cast — waiting for results…' : 'Answer submitted — waiting for results…'}
                    </p>
                </div>
            ) : (

                <>
                    {/* ── Trivia: multiple choice buttons ── */}
                    {activeGame.type === 'trivia' && (
                        <>
                            {activeGame.config.question && (
                                <p className="text-xs text-zinc-300 mb-3 leading-snug">{activeGame.config.question}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                {(activeGame.config.options ?? []).map((opt, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => submitOption(idx)}
                                        disabled={isExpired}
                                        aria-label={`Option ${OPTION_LABELS[idx]}: ${opt}`}
                                        aria-pressed={selectedOpt === idx}
                                        className={cn(
                                            'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                                            OPTION_COLORS[idx],
                                            isExpired && 'opacity-40 cursor-not-allowed',
                                            selectedOpt === idx && 'ring-2 ring-white/30',
                                        )}
                                    >
                                        <span className="text-[10px] font-bold uppercase opacity-70 shrink-0">
                                            {OPTION_LABELS[idx]}
                                        </span>
                                        <span className="text-xs leading-tight">{opt}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Lyric Fill-in: lyric prompt + text input ── */}
                    {activeGame.type === 'lyric_fill' && (
                        <>
                            {activeGame.config.lyric && (
                                <p className="text-xs text-zinc-300 italic mb-3 leading-snug bg-white/5 rounded-lg px-2.5 py-2">
                                    "{activeGame.config.lyric}"
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    value={textAnswer}
                                    onChange={e => setTextAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitText()}
                                    placeholder="Fill in the blank…"
                                    disabled={isExpired}
                                    className="flex-1 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus-visible:ring-violet-500"
                                />
                                <Button
                                    onClick={submitText}
                                    disabled={!textAnswer.trim() || isExpired}
                                    size="sm"
                                    className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shrink-0"
                                >
                                    <Send className="size-3" />
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ── Song Guesser: free text ── */}
                    {activeGame.type === 'song_guesser' && (
                        <div className="flex gap-2">
                            <Input
                                value={textAnswer}
                                onChange={e => setTextAnswer(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitText()}
                                placeholder="Song title or artist…"
                                disabled={isExpired}
                                className="flex-1 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus-visible:ring-violet-500"
                            />
                            <Button
                                onClick={submitText}
                                disabled={!textAnswer.trim() || isExpired}
                                size="sm"
                                className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shrink-0"
                            >
                                <Send className="size-3" />
                            </Button>
                        </div>
                    )}

                    {/* ── Skip Battle: one vote button ── */}
                    {activeGame.type === 'skip_battle' && (
                        <button
                            onClick={submitVote}
                            disabled={isExpired}
                            aria-label="Vote to skip current song"
                            className={cn(
                                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                                'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25',
                                isExpired && 'opacity-40 cursor-not-allowed',
                            )}
                        >
                            <Zap className="size-4" /> Vote to Skip
                        </button>
                    )}
                </>
            )}

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-1000', urgentTime ? 'bg-red-400' : 'bg-violet-500')}
                    style={{ width: `${(gameSecondsLeft / activeGame.durationSeconds) * 100}%` }}
                />
            </div>
        </div>
    )
}
