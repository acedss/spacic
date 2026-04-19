// BroadcastAssetsTab — Studio tab for managing pre-recorded/uploaded audio clips.
// Mirrors the Minigames tab pattern: list → create form → delete.
// Upload flow: get presigned PUT URL → PUT blob to S3 → confirm (updates status → 'ready').
import { useState, useRef, useCallback } from 'react'
import { Mic, Upload, Play, Trash2, Plus, Loader2, Radio, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { BroadcastAsset } from '@/types/types'
import {
    listBroadcastAssets,
    uploadBroadcastBlob,
    deleteAsset,
} from '@/lib/broadcastService'
import { cn } from '@/lib/utils'

// Read audio duration by loading into an off-screen Audio element.
// Returns 0 on error — non-blocking; a missing duration is cosmetic only.
const getAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
        const url   = URL.createObjectURL(file)
        const audio = new Audio(url)
        audio.addEventListener('loadedmetadata', () => {
            const dur = isFinite(audio.duration) ? Math.round(audio.duration) : 0
            URL.revokeObjectURL(url)
            resolve(dur)
        })
        audio.addEventListener('error', () => {
            URL.revokeObjectURL(url)
            resolve(0)
        })
    })

const fmtDur = (s: number | null) => {
    if (s == null) return '—'
    const m = Math.floor(s / 60)
    const rem = Math.round(s % 60)
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`
}

const fmtSize = (b: number | null) => {
    if (b == null) return '—'
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
    assets:         BroadcastAsset[]
    loading:        boolean
    onAssetsChange: (assets: BroadcastAsset[]) => void
}

type CreateMode = 'file' | 'recording'

// ── Recording state machine (matches CreatorMicButton pattern) ────────────────
type RecState = 'idle' | 'recording' | 'uploading'

export const BroadcastAssetsTab = ({ assets, loading, onAssetsChange }: Props) => {
    const [showForm, setShowForm] = useState(false)
    const [mode, setMode]         = useState<CreateMode>('file')
    const [label, setLabel]       = useState('')

    // File upload
    const [fileObj, setFileObj]   = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Recording
    const [recState, setRecState] = useState<RecState>('idle')
    const [recSecs, setRecSecs]   = useState(0)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef   = useRef<Blob[]>([])
    const streamRef   = useRef<MediaStream | null>(null)
    const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const resetForm = () => {
        setShowForm(false)
        setLabel('')
        setFileObj(null)
        setRecState('idle')
        setRecSecs(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ── File upload flow ──────────────────────────────────────────────────────

    const handleFileUpload = async () => {
        if (!label.trim() || !fileObj) return
        setUploading(true)
        try {
            const durationSeconds = await getAudioDuration(fileObj)
            const asset = await uploadBroadcastBlob(fileObj, label.trim(), 'file', {
                durationSeconds,
            })
            onAssetsChange([asset, ...assets])
            toast.success(`"${asset.label}" uploaded`)
            resetForm()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    // ── Recording flow ────────────────────────────────────────────────────────
    // TODO(human): This is identical in spirit to CreatorMicButton.tsx.
    // Consider extracting a shared useRecorder() hook for DRY reuse.

    const startRecording = useCallback(async () => {
        if (!streamRef.current) {
            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch {
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

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

        recorder.onstop = async () => {
            setRecState('uploading')
            if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }

            try {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                const dur  = recSecs // captured at stop time
                const asset = await uploadBroadcastBlob(blob, label.trim() || 'Recording', 'recording', {
                    durationSeconds: dur,
                })
                onAssetsChange([asset, ...assets])
                toast.success(`"${asset.label}" saved`)
                resetForm()
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Upload failed')
                setRecState('idle')
            }
        }

        recorder.start(200)
        setRecState('recording')
        setRecSecs(0)
        recTimerRef.current = setInterval(() => setRecSecs(p => p + 1), 1000)
    }, [label, assets, onAssetsChange, recSecs])

    const stopRecording = useCallback(() => {
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop()
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }, [])

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (id: string, assetLabel: string) => {
        if (!confirm(`Delete "${assetLabel}"?`)) return
        try {
            await deleteAsset(id)
            onAssetsChange(assets.filter(a => a._id !== id))
            toast.success('Asset deleted')
        } catch {
            toast.error('Failed to delete asset')
        }
    }

    // ── Reload ────────────────────────────────────────────────────────────────

    const handleReload = async () => {
        try {
            const fresh = await listBroadcastAssets()
            onAssetsChange(fresh)
        } catch {
            toast.error('Failed to reload')
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Broadcast Assets</h2>
                    <p className="text-xs text-zinc-500 mt-1">Pre-recorded intros & clips — trigger from the Live Dashboard.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleReload} className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors">
                        Refresh
                    </button>
                    <button
                        onClick={() => setShowForm(p => !p)}
                        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm text-white transition-colors"
                    >
                        <Plus className="size-3.5" /> New Asset
                    </button>
                </div>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                    {/* Mode switcher */}
                    <div className="flex gap-2">
                        {(['file', 'recording'] as CreateMode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                                    mode === m
                                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white',
                                )}
                            >
                                {m === 'file' ? <Upload className="size-3" /> : <Mic className="size-3" />}
                                {m === 'file' ? 'Upload file' : 'Record intro'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="text-xs text-zinc-500 mb-1.5 block">Label</label>
                        <Input
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder={mode === 'file' ? 'e.g. Intro clip' : 'e.g. Welcome message'}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9"
                        />
                    </div>

                    {/* File upload */}
                    {mode === 'file' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1.5 block">Audio file</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    onChange={e => setFileObj(e.target.files?.[0] ?? null)}
                                    className="block text-xs text-zinc-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs file:font-medium hover:file:bg-white/15 cursor-pointer"
                                />
                                {fileObj && (
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        {fileObj.name} · {fmtSize(fileObj.size)}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={resetForm} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                <button
                                    onClick={handleFileUpload}
                                    disabled={uploading || !label.trim() || !fileObj}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-sm text-white transition-colors"
                                >
                                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                    Upload
                                </button>
                            </div>
                        </div>
                    )}

                    {/* In-browser recording */}
                    {mode === 'recording' && (
                        <div className="space-y-3">
                            <div className={cn(
                                'rounded-xl border px-4 py-3 flex items-center gap-3',
                                recState === 'recording'
                                    ? 'border-red-500/30 bg-red-500/8'
                                    : recState === 'uploading'
                                        ? 'border-blue-500/30 bg-blue-500/8'
                                        : 'border-white/10 bg-white/3',
                            )}>
                                {recState === 'idle' && <Mic className="size-4 text-zinc-500" />}
                                {recState === 'recording' && <Mic className="size-4 text-red-400 animate-pulse" />}
                                {recState === 'uploading' && <Loader2 className="size-4 text-blue-400 animate-spin" />}
                                <p className="text-sm text-zinc-300 flex-1">
                                    {recState === 'idle'      && 'Click Record to start'}
                                    {recState === 'recording' && `Recording… ${recSecs}s`}
                                    {recState === 'uploading' && 'Uploading to S3…'}
                                </p>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button onClick={resetForm} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                {recState === 'idle' && (
                                    <button
                                        onClick={startRecording}
                                        disabled={!label.trim()}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm text-white transition-colors"
                                    >
                                        <Mic className="size-3.5" /> Record
                                    </button>
                                )}
                                {recState === 'recording' && (
                                    <button
                                        onClick={stopRecording}
                                        className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm text-white transition-colors"
                                    >
                                        Stop
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Assets list */}
            {loading ? (
                <div className="flex items-center gap-2 text-zinc-400 py-5 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Loading assets…
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">No assets yet — upload or record one above</div>
            ) : (
                <div className="space-y-2">
                    {assets.map(a => (
                        <div key={a._id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-4">
                            <div className={cn(
                                'size-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                a.type === 'recording' ? 'bg-violet-500/20' : 'bg-blue-500/20',
                            )}>
                                {a.type === 'recording'
                                    ? <Mic className="size-3.5 text-violet-400" />
                                    : <Radio className="size-3.5 text-blue-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{a.label}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                                    <span className="capitalize">{a.type}</span>
                                    {a.durationSeconds != null && (
                                        <span className="flex items-center gap-0.5"><Clock className="size-2.5" /> {fmtDur(a.durationSeconds)}</span>
                                    )}
                                    {a.sizeBytes != null && <span>{fmtSize(a.sizeBytes)}</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                                    <Play className="size-2.5" /> Ready
                                </div>
                                <button onClick={() => handleDelete(a._id, a.label)} className="text-zinc-600 hover:text-red-400 transition-colors">
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
