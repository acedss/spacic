// CreatorMicButton — activate before song end, record during the gap between songs
// Flow: click → countdown to song end → speaking window opens → record up to 10s → broadcast
import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2, Clock } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { useAudioRef } from '@/providers/AudioProvider'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
    socket: Socket | null
    roomId: string
    disabled?: boolean
}

type MicState = 'idle' | 'countdown' | 'recording' | 'sending'

const MAX_RECORDING_MS = 10_000
const CHUNK_SIZE = 48_000

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
    const audioRef = useAudioRef()
    const { currentTimeMs } = usePlayerStore()
    const [micState, setMicState] = useState<MicState>('idle')
    const [secsLeft, setSecsLeft] = useState(0) // Countdown to song end OR recording time left
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const recordingLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearTimers = useCallback(() => {
        if (countdownRef.current) clearInterval(countdownRef.current)
        if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current)
    }, [])

    // Calculate seconds until song ends
    const getSecsUntilSongEnd = useCallback(() => {
        if (!audioRef.current) return 0
        const duration = audioRef.current.duration
        const current = currentTimeMs / 1000
        return Math.max(0, Math.round(duration - current))
    }, [audioRef, currentTimeMs])

    // Start countdown when button is clicked (idle → countdown)
    const startCountdown = useCallback(() => {
        clearTimers()
        setMicState('countdown')
        setSecsLeft(getSecsUntilSongEnd())

        // Countdown timer: update every 1s until song ends
        countdownRef.current = setInterval(() => {
            const secs = getSecsUntilSongEnd()
            setSecsLeft(secs)
            // When countdown reaches 0, auto-start recording
            if (secs === 0) {
                clearInterval(countdownRef.current!)
                startRecording()
            }
        }, 1000)
    }, [getSecsUntilSongEnd, clearTimers])

    // Request mic access and start recording (countdown → recording)
    const startRecording = useCallback(async () => {
        clearTimers()

        // Request mic access if not already granted
        if (!streamRef.current) {
            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch {
                setMicState('idle')
                toast.error('Mic access denied — check browser permissions')
                return
            }
        }

        let mimeType = 'audio/webm;codecs=opus'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''

        const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
            setMicState('sending')
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            const buffer = await blob.arrayBuffer()
            const b64Chunks = toBase64Chunks(buffer)

            if (socket && b64Chunks.length > 0) {
                socket.emit('room:creator_speaking', { roomId })
                for (const chunk of b64Chunks) {
                    socket.emit('room:audio_chunk', { roomId, chunk, mimeType: 'audio/webm' })
                }
                socket.emit('room:creator_done', { roomId })
                toast.success('Voice broadcast sent to listeners')
            }

            setMicState('idle')
            setSecsLeft(0)
        }

        recorder.start(200) // 200ms timeslices
        setMicState('recording')
        setSecsLeft(10) // Show 10s countdown during recording

        // Countdown display during recording
        countdownRef.current = setInterval(() => {
            setSecsLeft(p => Math.max(0, p - 1))
        }, 1000)

        // Auto-stop after 10s max
        recordingLimitRef.current = setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop()
        }, MAX_RECORDING_MS)
    }, [socket, roomId, clearTimers])

    const handleClick = useCallback(() => {
        if (micState === 'idle') {
            startCountdown()
        } else if (micState === 'countdown') {
            // User cancels countdown before song ends
            clearTimers()
            setMicState('idle')
            setSecsLeft(0)
        } else if (micState === 'recording') {
            // Stop recording early
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop()
            }
            clearTimers()
        }
    }, [micState, startCountdown, clearTimers])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimers()
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
        }
    }, [clearTimers])

    const buttonText = {
        idle: '🎤 Speak',
        countdown: `Ready in ${secsLeft}s`,
        recording: `Recording • ${secsLeft}s`,
        sending: 'Sending…',
    }[micState]

    const buttonIcon = {
        idle: <Mic className="size-3" />,
        countdown: <Clock className="size-3 animate-pulse" />,
        recording: <MicOff className="size-3" />,
        sending: <Loader2 className="size-3 animate-spin" />,
    }[micState]

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            title={
                micState === 'idle' ? 'Click to activate mic (activates when song ends)' :
                micState === 'countdown' ? `Waiting for song to end (${secsLeft}s left) — click to cancel` :
                micState === 'recording' ? 'Recording — click to stop early' :
                'Sending…'
            }
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border select-none',
                micState === 'idle'
                    ? 'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25'
                    : micState === 'countdown'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : micState === 'recording'
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-zinc-800 border-white/10 text-zinc-400',
                disabled && 'opacity-40 cursor-not-allowed'
            )}
        >
            {buttonIcon}
            {buttonText}
        </button>
    )
}
