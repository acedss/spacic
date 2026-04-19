// CreatorSpeakingOverlay — shown to listeners during two types of creator broadcast:
//   1. Live mic: base64 audio chunks assembled via AudioContext (room:creator_done)
//   2. Broadcast asset: presigned S3 URL played via <audio> element (room:asset_broadcast)
import { useEffect, useRef, useState } from 'react'
import { Mic, Radio } from 'lucide-react'
import { useRoomStore } from '@/stores/useRoomStore'
import { cn } from '@/lib/utils'

interface Props {
    creatorName?: string
}

export const CreatorSpeakingOverlay = ({ creatorName = 'Creator' }: Props) => {
    const { creatorAudio, clearCreatorAudio, broadcastAsset, clearBroadcastAsset } = useRoomStore()
    const [playing, setPlaying] = useState(false)
    const [assetPlaying, setAssetPlaying] = useState(false)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const assetAudioRef = useRef<HTMLAudioElement | null>(null)

    const getCtx = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContext()
        }
        return audioCtxRef.current
    }

    useEffect(() => {
        if (creatorAudio.state !== 'done' || creatorAudio.chunks.length === 0) return

        const chunks = [...creatorAudio.chunks]
        clearCreatorAudio()

        ;(async () => {
            setPlaying(true)
            try {
                // Reassemble base64 chunks → Uint8Array
                let totalLen = 0
                const decoded = chunks.map(b64 => {
                    const bin = atob(b64)
                    const arr = new Uint8Array(bin.length)
                    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
                    totalLen += arr.length
                    return arr
                })
                const combined = new Uint8Array(totalLen)
                let offset = 0
                for (const arr of decoded) { combined.set(arr, offset); offset += arr.length }

                const ctx = getCtx()
                if (ctx.state === 'suspended') await ctx.resume()

                const audioBuffer = await ctx.decodeAudioData(combined.buffer)
                const source = ctx.createBufferSource()
                source.buffer = audioBuffer
                source.connect(ctx.destination)
                source.onended = () => setPlaying(false)
                source.start(0)
            } catch (err) {
                console.warn('[CreatorSpeakingOverlay] playback failed:', err)
                setPlaying(false)
            }
        })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [creatorAudio.state])

    // ── Broadcast asset: play presigned URL directly ──────────────────────────
    useEffect(() => {
        if (!broadcastAsset) return

        const audio = new Audio(broadcastAsset.url)
        assetAudioRef.current = audio
        setAssetPlaying(true)

        audio.play().catch(err => console.warn('[BroadcastAsset] play failed:', err))
        audio.onended = () => {
            setAssetPlaying(false)
            clearBroadcastAsset()
        }
        audio.onerror = () => {
            setAssetPlaying(false)
            clearBroadcastAsset()
        }

        return () => {
            audio.pause()
            audio.src = ''
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [broadcastAsset])

    const micVisible   = creatorAudio.state === 'receiving' || playing
    const assetVisible = assetPlaying || !!broadcastAsset

    if (!micVisible && !assetVisible) return null

    // ── Broadcast asset overlay ──────────────────────────────────────────────
    if (assetVisible) {
        return (
            <div className={cn(
                'fixed bottom-36 left-1/2 -translate-x-1/2 z-50 pointer-events-none',
                'flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md',
                'bg-blue-900/80 border-blue-500/40 text-blue-200',
            )}>
                <div className="size-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/30">
                    <Radio className="size-4 text-blue-300 animate-pulse" />
                </div>
                <div>
                    <p className="text-sm font-semibold leading-none">
                        {broadcastAsset?.label ?? 'Broadcast'}
                    </p>
                    <p className="text-xs opacity-60 mt-0.5">Playing from {creatorName}</p>
                </div>
                <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
                    {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
                        <div key={i} className="w-0.5 rounded-full bg-blue-400"
                            style={{ height: `${h * 100}%`, animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate` }} />
                    ))}
                </div>
            </div>
        )
    }

    // ── Live mic overlay ─────────────────────────────────────────────────────
    const isPlaying = playing
    return (
        <div className={cn(
            'fixed bottom-36 left-1/2 -translate-x-1/2 z-50 pointer-events-none',
            'flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md',
            isPlaying
                ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-200'
                : 'bg-violet-900/80 border-violet-500/40 text-violet-200'
        )}>
            <div className={cn(
                'size-8 rounded-full flex items-center justify-center flex-shrink-0',
                isPlaying ? 'bg-emerald-500/30' : 'bg-violet-500/30'
            )}>
                <Mic className={cn('size-4', isPlaying ? 'text-emerald-300' : 'text-violet-300 animate-pulse')} />
            </div>
            <div>
                <p className="text-sm font-semibold leading-none">
                    {isPlaying ? 'Playing voice message' : `${creatorName} is speaking…`}
                </p>
                <p className="text-xs opacity-60 mt-0.5">
                    {isPlaying ? 'Creator broadcast' : 'Preparing audio'}
                </p>
            </div>
            <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
                {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
                    <div
                        key={i}
                        className={cn('w-0.5 rounded-full', isPlaying ? 'bg-emerald-400' : 'bg-violet-400')}
                        style={{
                            height: `${h * 100}%`,
                            animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
