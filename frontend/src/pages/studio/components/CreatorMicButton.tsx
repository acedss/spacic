// CreatorMicButton — record-then-broadcast audio (max 10s)
// Flow: click → MediaRecorder starts → stop (manual or 10s limit) → base64 chunks emitted via socket
import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
    socket: Socket | null
    roomId: string
    disabled?: boolean
}

type MicState = 'idle' | 'recording' | 'sending'

const MAX_MS = 10_000
const CHUNK_SIZE = 48_000 // bytes — stays well under typical socket message limits

function toBase64Chunks(buffer: ArrayBuffer): string[] {
    const bytes = new Uint8Array(buffer)
    const chunks: string[] = []
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const slice = bytes.slice(i, i + CHUNK_SIZE)
        chunks.push(btoa(String.fromCharCode(...slice)))
    }
    return chunks
}

export const CreatorMicButton = ({ socket, roomId, disabled }: Props) => {
    const [micState, setMicState] = useState<MicState>('idle')
    const [secsLeft, setSecsLeft] = useState(10)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef   = useRef<Blob[]>([])
    const hardLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const clearTimers = useCallback(() => {
        if (hardLimitRef.current) clearTimeout(hardLimitRef.current)
        if (countdownRef.current) clearInterval(countdownRef.current)
    }, [])

    const finishRecording = useCallback(async (stream: MediaStream) => {
        clearTimers()
        setMicState('sending')
        stream.getTracks().forEach(t => t.stop())

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const buffer = await blob.arrayBuffer()
        const b64Chunks = toBase64Chunks(buffer)

        if (!socket || b64Chunks.length === 0) {
            setMicState('idle')
            return
        }

        socket.emit('room:creator_speaking', { roomId })
        for (const chunk of b64Chunks) {
            socket.emit('room:audio_chunk', { roomId, chunk, mimeType: 'audio/webm' })
        }
        socket.emit('room:creator_done', { roomId })

        setMicState('idle')
        setSecsLeft(10)
        toast.success('Voice broadcast sent')
    }, [socket, roomId, clearTimers])

    const handleClick = useCallback(async () => {
        if (micState === 'sending') return

        if (micState === 'recording') {
            recorderRef.current?.stop()
            return
        }

        // idle → start recording
        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
            toast.error('Mic access denied — check browser permissions')
            return
        }

        let mimeType = 'audio/webm;codecs=opus'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = () => finishRecording(stream)

        recorder.start(200) // 200ms timeslices
        setMicState('recording')
        setSecsLeft(10)

        // Countdown display
        countdownRef.current = setInterval(() => {
            setSecsLeft(p => Math.max(0, p - 1))
        }, 1000)

        // Hard limit
        hardLimitRef.current = setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop()
        }, MAX_MS)

    }, [micState, finishRecording])

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            title={micState === 'recording' ? `Recording — ${secsLeft}s left (click to stop)` : 'Broadcast voice to listeners'}
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border select-none',
                micState === 'recording'
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : micState === 'sending'
                        ? 'bg-zinc-800 border-white/10 text-zinc-400'
                        : 'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25',
                disabled && 'opacity-40 cursor-not-allowed'
            )}
        >
            {micState === 'sending'
                ? <Loader2 className="size-3 animate-spin" />
                : micState === 'recording'
                    ? <MicOff className="size-3" />
                    : <Mic className="size-3" />
            }
            {micState === 'recording'
                ? `Stop · ${secsLeft}s`
                : micState === 'sending'
                    ? 'Sending…'
                    : '🎤 Speak'
            }
        </button>
    )
}
