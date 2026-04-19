// BroadcastPanel — live dashboard panel for creator broadcast controls.
// Shows: Live mic button + pre-recorded asset quick-trigger list.
// Mirrors MinigamePanel layout: active state → quick-trigger list → empty state.
import { useState, useEffect } from 'react'
import { Play, Radio, Mic, Clock, Loader2 } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import type { BroadcastAsset } from '@/types/types'
import { CreatorMicButton } from './CreatorMicButton'
import { cn } from '@/lib/utils'

const fmtDur = (s: number | null) => {
    if (s == null) return '—'
    const m = Math.floor(s / 60)
    const rem = Math.round(s % 60)
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`
}

interface Props {
    socket:    Socket | null
    roomId:    string
    assets:    BroadcastAsset[]
    connected: boolean
}

export const BroadcastPanel = ({ socket, roomId, assets, connected }: Props) => {
    const [playingId, setPlayingId] = useState<string | null>(null)

    // io.to(roomId).emit() in socket.js sends to ALL sockets in the room, including
    // the creator's. So room:asset_broadcast is the reliable echo — clear playingId
    // when the server confirms it dispatched the URL, not on a guessed timeout.
    useEffect(() => {
        if (!socket) return
        const handler = ({ assetId }: { assetId: string }) => {
            setPlayingId(prev => (prev === assetId ? null : prev))
        }
        socket.on('room:asset_broadcast', handler)
        return () => { socket.off('room:asset_broadcast', handler) }
    }, [socket])

    const handlePlayAsset = (assetId: string) => {
        if (!socket || !connected || playingId) return
        socket.emit('room:asset_play', { roomId, assetId })
        setPlayingId(assetId)
    }

    return (
        <div className="space-y-4">
            {/* Live mic section */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <Mic className="size-3.5 text-violet-400" />
                    <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Live Mic</p>
                </div>
                <p className="text-[10px] text-zinc-500">
                    Speak between songs — activates when current song ends.
                </p>
                <CreatorMicButton socket={socket} roomId={roomId} disabled={!connected} />
            </div>

            {/* Asset quick-trigger */}
            {assets.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Recorded Assets</p>
                    {assets.map(a => {
                        const isPlaying = playingId === a._id
                        return (
                            <div
                                key={a._id}
                                className={cn(
                                    'flex items-center gap-3 border rounded-xl px-3 py-2.5 transition-colors',
                                    isPlaying
                                        ? 'border-blue-500/30 bg-blue-500/8'
                                        : 'bg-white/5 border-white/10',
                                )}
                            >
                                <div className={cn(
                                    'size-7 rounded-lg flex items-center justify-center flex-shrink-0',
                                    a.type === 'recording' ? 'bg-violet-500/20' : 'bg-blue-500/20',
                                )}>
                                    <Radio className={cn('size-3', a.type === 'recording' ? 'text-violet-400' : 'text-blue-400')} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{a.label}</p>
                                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                        <Clock className="size-2.5" /> {fmtDur(a.durationSeconds)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handlePlayAsset(a._id)}
                                    disabled={!connected || !!playingId}
                                    className={cn(
                                        'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white transition-colors',
                                        playingId
                                            ? 'bg-zinc-800 opacity-40 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-500',
                                    )}
                                >
                                    {isPlaying
                                        ? <><Loader2 className="size-3 animate-spin" /> Playing</>
                                        : <><Play className="size-3" /> Play</>
                                    }
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {assets.length === 0 && (
                <p className="text-xs text-zinc-700 text-center py-2">
                    No assets ready — add them in Studio → Broadcasts
                </p>
            )}
        </div>
    )
}
