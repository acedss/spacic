// Pretty modal-based song upload — uses /admin/songs/vocabulary for genre/mood
// suggestions and supports the rich metadata schema (BPM, key, tags, etc.).

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import {
    Plus, ImagePlus, Music2, Loader, ChevronDown, X, Sparkles, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldLabel, AdminDivider } from './admin-ui';

interface ArtistOpt { _id: string; name: string }
interface AlbumOpt  { _id: string; title: string; artistId?: { _id: string; name: string } | null }

interface Vocabulary { genres: string[]; moods: string[]; musicalKeys: string[] }

const ALLOWED_AUDIO = new Set([
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg',
    'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/webm',
]);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const getAxiosErrorMessage = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { message?: string } } };
    return e?.response?.data?.message ?? fallback;
};

const fmtBytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

const readAudioDuration = (file: File) => new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    const cleanup = () => { URL.revokeObjectURL(url); audio.removeAttribute('src'); audio.load(); };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
        const d = Math.round(audio.duration); cleanup();
        if (Number.isFinite(d) && d > 0) resolve(d); else reject(new Error('Invalid duration'));
    };
    audio.onerror = () => { cleanup(); reject(new Error('Cannot read audio metadata')); };
    audio.src = url;
});

interface Props {
    onUploaded: () => void;
    artists?: ArtistOpt[];
    albums?: AlbumOpt[];
}

export const AddSongDialog = ({ onUploaded, artists = [], albums = [] }: Props) => {
    const [open, setOpen] = useState(false);
    const [vocab, setVocab] = useState<Vocabulary>({ genres: [], moods: [], musicalKeys: [] });
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Required
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);

    // Soft links
    const [artistId, setArtistId] = useState('');
    const [albumId, setAlbumId] = useState('');

    // Metadata
    const [description, setDescription] = useState('');
    const [genre, setGenre] = useState<string[]>([]);
    const [mood, setMood] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [language, setLanguage] = useState('');
    const [bpm, setBpm] = useState('');
    const [musicalKey, setMusicalKey] = useState('');
    const [explicit, setExplicit] = useState(false);
    const [releaseDate, setReleaseDate] = useState('');
    const [originalArtist, setOriginalArtist] = useState('');
    const [license, setLicense] = useState('');
    const [isrc, setIsrc] = useState('');

    // Upload progress
    const [uploading, setUploading] = useState(false);
    const [stage, setStage] = useState<'idle' | 'uploading' | 'finalizing'>('idle');
    const [progress, setProgress] = useState(0);

    const audioRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        axiosInstance.get('/admin/songs/vocabulary')
            .then(r => setVocab(r.data.data))
            .catch(() => { /* not fatal — chips just won't show suggestions */ });
    }, [open]);

    const reset = () => {
        setTitle(''); setArtist(''); setImageUrl(''); setAudioFile(null);
        setArtistId(''); setAlbumId('');
        setDescription(''); setGenre([]); setMood([]); setTags([]); setTagInput('');
        setLanguage(''); setBpm(''); setMusicalKey(''); setExplicit(false);
        setReleaseDate(''); setOriginalArtist(''); setLicense(''); setIsrc('');
        setShowAdvanced(false);
    };

    const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
        setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

    const addTag = () => {
        const v = tagInput.trim();
        if (!v) return;
        if (tags.includes(v) || tags.length >= 12) { setTagInput(''); return; }
        setTags(t => [...t, v]); setTagInput('');
    };

    const handleImage = async (file: File) => {
        setImageUploading(true);
        try {
            const fd = new FormData(); fd.append('image', file);
            const { data } = await axiosInstance.post('/admin/songs/image-upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImageUrl(data.data.presignedUrl);
            toast.success('Cover uploaded');
        } catch (err) {
            toast.error(getAxiosErrorMessage(err, 'Image upload failed'));
        } finally { setImageUploading(false); }
    };

    const validate = (): string | null => {
        if (!title.trim() || title.trim().length < 2) return 'Title must be at least 2 characters';
        if (!artist.trim() || artist.trim().length < 2) return 'Artist must be at least 2 characters';
        if (!imageUrl.trim()) return 'Cover image is required';
        if (!audioFile) return 'Audio file is required';
        if (!ALLOWED_AUDIO.has(audioFile.type.toLowerCase()))
            return 'Unsupported audio format';
        if (audioFile.size <= 0 || audioFile.size > MAX_AUDIO_BYTES)
            return `Audio must be ≤ ${MAX_AUDIO_BYTES / 1024 / 1024}MB`;
        return null;
    };

    const handleSubmit = async () => {
        const err = validate(); if (err) { toast.error(err); return; }
        setUploading(true); setStage('uploading'); setProgress(0);
        try {
            const fd = new FormData(); fd.append('audio', audioFile!);
            const { data: u } = await axiosInstance.post('/admin/songs/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => e.total && setProgress(Math.min(100, Math.round(e.loaded / e.total * 100))),
            });
            const duration = await readAudioDuration(audioFile!);
            setStage('finalizing');
            await axiosInstance.post('/admin/songs', {
                title: title.trim(), artist: artist.trim(),
                imageUrl: imageUrl.trim(), s3Key: u.data.s3Key,
                duration, uploadToken: u.data.uploadToken,
                artistId: artistId || null,
                albumId: albumId || null,
                description: description.trim(),
                genre, mood, tags,
                language: language.trim(),
                bpm: bpm || null,
                musicalKey: musicalKey || null,
                explicit,
                releaseDate: releaseDate || null,
                originalArtist: originalArtist.trim(),
                license: license.trim(),
                isrc: isrc.trim(),
            });
            toast.success(`"${title.trim()}" uploaded`);
            onUploaded();
            reset();
            setOpen(false);
        } catch (e) {
            toast.error(getAxiosErrorMessage(e, 'Upload failed'));
        } finally {
            setUploading(false); setStage('idle'); setProgress(0);
        }
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}
                    className="bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)] hover:bg-[oklch(0.92_0.14_75)] gap-1.5 h-9 font-semibold press">
                <Plus className="size-4" /> Add Song
            </Button>

            <Dialog open={open} onOpenChange={(o) => { if (!uploading) setOpen(o); }}>
                <DialogContent
                    className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto hide-scrollbar p-0 border-white/10"
                    style={{ background: 'var(--ink-1)' }}>
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-white/10">
                        <p className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>New Track</p>
                        <DialogTitle className="serif text-2xl text-white mt-1">Upload a song</DialogTitle>
                        <DialogDescription className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
                            Required fields are marked with *. Add metadata to improve discoverability + RecSys quality.
                        </DialogDescription>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Cover + audio dropzones */}
                        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
                            {/* Cover */}
                            <div>
                                <FieldLabel required>Cover</FieldLabel>
                                <input type="file" accept="image/*" hidden ref={imageRef}
                                       onChange={e => { const f = e.target.files?.[0]; if (f) void handleImage(f); e.target.value = ''; }} />
                                <button
                                    type="button"
                                    onClick={() => imageRef.current?.click()}
                                    disabled={imageUploading || uploading}
                                    className="aspect-square w-full rounded-xl ring-1 ring-white/10 border border-dashed border-white/15 hover:bg-white/5 transition-colors flex items-center justify-center overflow-hidden press relative">
                                    {imageUrl ? (
                                        <>
                                            <img src={imageUrl} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors text-white text-xs opacity-0 hover:opacity-100">
                                                Replace
                                            </div>
                                        </>
                                    ) : imageUploading ? (
                                        <Loader className="size-5 animate-spin" style={{ color: 'var(--fg-3)' }} />
                                    ) : (
                                        <div className="text-center">
                                            <ImagePlus className="size-6 mx-auto" style={{ color: 'var(--fg-3)' }} />
                                            <p className="text-[11px] mt-1.5" style={{ color: 'var(--fg-3)' }}>Click to upload</p>
                                        </div>
                                    )}
                                </button>
                            </div>

                            {/* Audio + basic fields */}
                            <div className="space-y-3">
                                <div>
                                    <FieldLabel required>Audio file</FieldLabel>
                                    <input type="file" hidden ref={audioRef}
                                           accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/flac,audio/webm"
                                           onChange={e => setAudioFile(e.target.files?.[0] ?? null)} />
                                    <button
                                        type="button"
                                        onClick={() => audioRef.current?.click()}
                                        disabled={uploading}
                                        className={cn(
                                            'w-full h-11 rounded-lg ring-1 px-3 flex items-center gap-2 text-xs transition-colors press',
                                            audioFile
                                                ? 'ring-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                                : 'ring-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
                                        )}>
                                        <Music2 className="size-4 shrink-0" />
                                        <span className="truncate flex-1 text-left">
                                            {audioFile ? audioFile.name : 'Choose audio (mp3, wav, flac, m4a…)'}
                                        </span>
                                        {audioFile && <span className="tabular-nums shrink-0" style={{ color: 'var(--fg-3)' }}>{fmtBytes(audioFile.size)}</span>}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <FieldLabel required>Title</FieldLabel>
                                        <Input value={title} onChange={e => setTitle(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                    <div>
                                        <FieldLabel required>Artist</FieldLabel>
                                        <Input value={artist} onChange={e => setArtist(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <FieldLabel hint="optional">Artist link</FieldLabel>
                                        <select value={artistId} onChange={e => setArtistId(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-md text-white text-xs h-9 px-2">
                                            <option value="">— None —</option>
                                            {artists.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <FieldLabel hint="optional">Album</FieldLabel>
                                        <select value={albumId} onChange={e => setAlbumId(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-md text-white text-xs h-9 px-2">
                                            <option value="">— Single —</option>
                                            {albums.map(a => <option key={a._id} value={a._id}>{a.title}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Genre */}
                        <div>
                            <FieldLabel hint="pick up to 8">Genre</FieldLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {vocab.genres.map(g => (
                                    <button type="button" key={g} onClick={() => toggle(genre, setGenre, g)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-[11px] ring-1 transition-colors',
                                                genre.includes(g)
                                                    ? 'bg-violet-500/20 text-violet-200 ring-violet-500/40'
                                                    : 'bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10',
                                            )}>
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mood */}
                        <div>
                            <FieldLabel hint="pick up to 8">Mood</FieldLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {vocab.moods.map(m => (
                                    <button type="button" key={m} onClick={() => toggle(mood, setMood, m)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-[11px] ring-1 transition-colors',
                                                mood.includes(m)
                                                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/40'
                                                    : 'bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10',
                                            )}>
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tags */}
                        <div>
                            <FieldLabel hint="press Enter to add">Tags</FieldLabel>
                            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 p-2 min-h-[40px]">
                                {tags.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-white/10 text-[11px] text-white px-2 py-0.5">
                                        <Tag className="size-2.5" /> {t}
                                        <button onClick={() => setTags(s => s.filter(x => x !== t))} className="hover:text-rose-300">
                                            <X className="size-2.5" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                    placeholder={tags.length ? '' : 'studio, acoustic, summer…'}
                                    className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-zinc-600 min-w-[120px]" />
                            </div>
                        </div>

                        {/* Advanced toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                            style={{ color: 'var(--fg-2)' }}>
                            <ChevronDown className={cn('size-3.5 transition-transform', showAdvanced && 'rotate-180')} />
                            {showAdvanced ? 'Hide' : 'Show'} advanced metadata
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4">
                                <AdminDivider label="Audio" />
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <FieldLabel>BPM</FieldLabel>
                                        <Input type="number" min={30} max={300} value={bpm}
                                               onChange={e => setBpm(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                    <div>
                                        <FieldLabel>Key</FieldLabel>
                                        <select value={musicalKey} onChange={e => setMusicalKey(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-md text-white text-xs h-9 px-2">
                                            <option value="">—</option>
                                            {vocab.musicalKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <FieldLabel>Language</FieldLabel>
                                        <Input value={language} placeholder="en"
                                               onChange={e => setLanguage(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                </div>

                                <AdminDivider label="Release" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Release date</FieldLabel>
                                        <Input type="date" value={releaseDate}
                                               onChange={e => setReleaseDate(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 h-9 mt-[22px]">
                                        <label htmlFor="explicit-switch" className="text-xs font-medium text-white cursor-pointer">Explicit content</label>
                                        <Switch id="explicit-switch" checked={explicit} onCheckedChange={setExplicit} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Original artist</FieldLabel>
                                        <Input value={originalArtist} placeholder="if cover"
                                               onChange={e => setOriginalArtist(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                    <div>
                                        <FieldLabel>License</FieldLabel>
                                        <Input value={license} placeholder="CC-BY, owned…"
                                               onChange={e => setLicense(e.target.value)}
                                               className="bg-white/5 border-white/10 text-white h-9" />
                                    </div>
                                </div>

                                <div>
                                    <FieldLabel>ISRC</FieldLabel>
                                    <Input value={isrc} placeholder="e.g. USRC17607839"
                                           onChange={e => setIsrc(e.target.value)}
                                           className="bg-white/5 border-white/10 text-white h-9 mono" />
                                </div>

                                <AdminDivider label="Description" />
                                <textarea value={description} onChange={e => setDescription(e.target.value)}
                                          rows={3} maxLength={2000}
                                          placeholder="Liner notes, story, credits…"
                                          className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-xs px-3 py-2 placeholder:text-zinc-600 resize-none" />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/10 sticky bottom-0 backdrop-blur-md flex items-center gap-3"
                         style={{ background: 'color-mix(in oklab, var(--ink-1) 92%, transparent)' }}>
                        {uploading && (
                            <div className="flex-1">
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full bg-[oklch(0.88_0.12_75)] transition-all" style={{ width: `${stage === 'finalizing' ? 100 : progress}%` }} />
                                </div>
                                <p className="text-[10px] mono uppercase tracking-wider mt-1" style={{ color: 'var(--fg-3)' }}>
                                    {stage === 'finalizing' ? 'Finalizing…' : `Uploading ${progress}%`}
                                </p>
                            </div>
                        )}
                        {!uploading && <div className="flex-1" />}
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading} className="text-zinc-400">
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={uploading}
                                className="bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)] hover:bg-[oklch(0.92_0.14_75)] gap-1.5 font-semibold press">
                            {uploading ? <Loader className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                            {uploading ? 'Uploading…' : 'Publish track'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
