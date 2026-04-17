// MinigamePanel — active game display, quick-trigger list, and inline game creation
import { useState } from 'react'
import { Play, Gamepad2, Plus, Trophy } from 'lucide-react'
import { CreateGameDialog } from './CreateGameDialog'
import type { Minigame, ActiveGame } from '@/types/types'
import { cn } from '@/lib/utils'

const GAME_TYPE_LABELS: Record<string, string> = {
    song_guesser: 'Song Guesser',
    lyric_fill:   'Lyric Fill-in',
    trivia:       'Trivia',
    skip_battle:  'Skip Battle',
}

interface Props {
    roomId: string
    creatorBalance: number
    minigames: Minigame[]
    activeGame: ActiveGame | null
    gameSecondsLeft: number
    onTrigger: (minigameId: string) => void
    onGameAdded: (game: Minigame) => void
}

export const MinigamePanel = ({
    roomId, creatorBalance, minigames, activeGame, gameSecondsLeft, onTrigger, onGameAdded,
}: Props) => {
    const [createOpen, setCreateOpen] = useState(false)

    const scheduledGames = minigames.filter(g => g.status === 'draft' || g.status === 'scheduled')
    const completedGames = minigames.filter(g => g.status === 'completed').slice(-3)

    return (
        <div className="space-y-4">
            {/* Active game */}
            {activeGame && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-red-300">
                            {GAME_TYPE_LABELS[activeGame.type] ?? activeGame.type}
                        </p>
                        <span className="text-lg font-bold text-white tabular-nums">{gameSecondsLeft}s</span>
                    </div>
                    <p className="text-xs text-white font-medium">{activeGame.title}</p>
                    {activeGame.config.question && (
                        <p className="text-xs text-zinc-300 bg-white/5 rounded-lg px-2.5 py-1.5">{activeGame.config.question}</p>
                    )}
                    {activeGame.config.lyric && (
                        <p className="text-xs text-zinc-300 italic bg-white/5 rounded-lg px-2.5 py-1.5">"{activeGame.config.lyric}"</p>
                    )}
                    {activeGame.coinReward > 0 && (
                        <p className="text-xs text-yellow-400 flex items-center gap-1">
                            <Trophy className="size-3" /> {activeGame.coinReward.toLocaleString()} WinPoints prize
                        </p>
                    )}
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-red-400 rounded-full transition-all duration-1000"
                            style={{ width: `${(gameSecondsLeft / activeGame.durationSeconds) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Quick-trigger list */}
            {scheduledGames.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Quick trigger</p>
                    {scheduledGames.map(g => (
                        <div key={g._id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{g.title}</p>
                                <p className="text-[10px] text-zinc-500">
                                    {GAME_TYPE_LABELS[g.type]} · {g.durationSeconds}s
                                    {g.coinReward > 0 && ` · ${g.coinReward} 🪙`}
                                </p>
                            </div>
                            <button
                                onClick={() => onTrigger(g._id)}
                                disabled={!!activeGame}
                                className={cn(
                                    'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white transition-colors',
                                    activeGame ? 'bg-zinc-800 opacity-40 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500'
                                )}
                            >
                                <Play className="size-3" /> Go
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent completed */}
            {completedGames.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Recent results</p>
                    {completedGames.map(g => (
                        <div key={g._id} className="flex items-center gap-2 px-3 py-2 bg-white/3 rounded-xl">
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-zinc-400 truncate">{g.title}</p>
                            </div>
                            {g.winner
                                ? <span className="text-[11px] text-emerald-400 flex-shrink-0">{g.winner.username} won</span>
                                : <span className="text-[11px] text-zinc-600 flex-shrink-0">No winner</span>
                            }
                        </div>
                    ))}
                </div>
            )}

            {scheduledGames.length === 0 && !activeGame && (
                <p className="text-xs text-zinc-700 text-center py-2">No games ready — create one below</p>
            )}

            {/* Create new */}
            <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-white/15 hover:border-violet-500/40 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                <Plus className="size-3.5" /> <Gamepad2 className="size-3.5" /> New game
            </button>

            <CreateGameDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                roomId={roomId}
                creatorBalance={creatorBalance}
                onCreated={onGameAdded}
            />
        </div>
    )
}
