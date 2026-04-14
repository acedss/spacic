// ListenerGamePanel — shown to listeners when an active minigame is running
// Reads activeGame + gameSecondsLeft from useRoomStore (set by useRoomSocket handlers)
// Calls submitAnswer from useRoomSession when listener submits
import { useState } from 'react'
import { Trophy, Clock, Gamepad2, Send } from 'lucide-react'
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

export const ListenerGamePanel = () => {
    const { activeGame, gameSecondsLeft } = useRoomStore()
    const { submitAnswer } = useRoomSession()

    const [answer, setAnswer]     = useState('')
    const [submitted, setSubmitted] = useState(false)

    // Reset input whenever a new game starts
    const gameId = activeGame?.minigameId
    // biome-ignore: intentional key-derived reset
    if (!gameId) return null

    const handleSubmit = () => {
        if (!answer.trim() || submitted || !activeGame) return
        submitAnswer(activeGame.minigameId, answer.trim())
        setSubmitted(true)
    }

    const urgentTime = gameSecondsLeft <= 5
    const prompt = activeGame.config.question
        ?? activeGame.config.lyric
        ?? activeGame.title

    return (
        <div
            key={gameId}
            className={cn(
                'fixed bottom-52 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm',
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
                        <p className="text-xs text-white font-semibold leading-tight mt-0.5">
                            {activeGame.coinReward.toLocaleString()} 🪙 prize
                        </p>
                    </div>
                </div>

                {/* Countdown */}
                <div className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums',
                    urgentTime
                        ? 'bg-red-500/20 text-red-300 animate-pulse'
                        : 'bg-white/10 text-zinc-300',
                )}>
                    <Clock className="size-3" />
                    {gameSecondsLeft}s
                </div>
            </div>

            {/* Question / Lyric prompt */}
            <p className="text-sm text-white mb-3 leading-snug">
                {activeGame.config.lyric ? (
                    <>
                        <span className="text-zinc-400 text-xs block mb-1">Complete the lyric:</span>
                        <em className="not-italic text-violet-200">"{activeGame.config.lyric}"</em>
                    </>
                ) : (
                    prompt
                )}
            </p>

            {/* Answer input + submit */}
            {submitted ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                    <Trophy className="size-3.5 text-green-400 flex-shrink-0" />
                    <p className="text-xs text-green-300">Answer submitted — waiting for results…</p>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Input
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Your answer…"
                        disabled={gameSecondsLeft === 0}
                        className="flex-1 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus-visible:ring-violet-500"
                    />
                    <Button
                        onClick={handleSubmit}
                        disabled={!answer.trim() || gameSecondsLeft === 0}
                        size="sm"
                        className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex-shrink-0"
                    >
                        <Send className="size-3" />
                    </Button>
                </div>
            )}
        </div>
    )
}
