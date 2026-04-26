import { ImageIcon, Loader2, Save, Tag, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { uploadCoverImage } from '@/lib/roomService';
import { updateFeatureFlags } from '@/lib/broadcastService';
import type { RoomFeatureFlags, Song } from '@/types/types';
import { SongSelector } from './SongSelector';
import { Card, FieldLabel, SectionHead } from './studio-atoms';
import { ALL_TAGS } from './studio-shared';
import { useState } from 'react';

interface Props {
    isLive: boolean;
    hasRoom: boolean;
    saving: boolean;
    error: string | null;
    title: string;
    setTitle: (v: string) => void;
    description: string;
    setDescription: (v: string) => void;
    isPublic: boolean;
    setIsPublic: (v: boolean) => void;
    streamGoal: string;
    setStreamGoal: (v: string) => void;
    selectedTags: string[];
    setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
    coverImageUrl: string | null;
    setCoverImageUrl: (v: string | null) => void;
    coverImageKey: string | null;
    setCoverImageKey: (v: string | null) => void;
    songs: Song[];
    songsLoading: boolean;
    selectedIds: string[];
    setSelectedIds: (v: string[]) => void;
    onSave: (e: React.FormEvent) => void;
    onNavigateToPlaylists: () => void;
    featureFlags: RoomFeatureFlags;
    setFeatureFlags: React.Dispatch<React.SetStateAction<RoomFeatureFlags>>;
}

export const SettingsTab = ({
    isLive, hasRoom, saving, error,
    title, setTitle, description, setDescription, isPublic, setIsPublic,
    streamGoal, setStreamGoal, selectedTags, setSelectedTags,
    coverImageUrl, setCoverImageUrl, coverImageKey, setCoverImageKey,
    songs, songsLoading, selectedIds, setSelectedIds,
    onSave, onNavigateToPlaylists, featureFlags, setFeatureFlags,
}: Props) => {
    const [coverUploading, setCoverUploading] = useState(false);
    const [savingFlags, setSavingFlags] = useState(false);

    const toggleTag = (tag: string) => setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

    const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }

        setCoverUploading(true);
        try {
            const { key, presignedUrl } = await uploadCoverImage(file);
            setCoverImageKey(key);
            setCoverImageUrl(presignedUrl);
            toast.success('Cover image uploaded — save to apply');
        } catch {
            toast.error('Failed to upload cover image');
        } finally {
            setCoverUploading(false);
        }
    };

    const handleSaveFlags = async () => {
        setSavingFlags(true);
        try {
            const updated = await updateFeatureFlags(featureFlags);
            setFeatureFlags(updated);
            toast.success('Room features saved');
        } catch { toast.error('Failed to save features'); }
        finally { setSavingFlags(false); }
    };

    void coverImageKey;

    return (
        <form onSubmit={onSave} className="space-y-5 max-w-2xl">
            <Card className="space-y-5">
                <SectionHead label="Channel Info" />

                <div>
                    <FieldLabel>Cover image</FieldLabel>
                    <label className={cn(
                        'flex items-center gap-4 cursor-pointer rounded-xl ring-1 ring-white/10 overflow-hidden transition-all hover:ring-white/20 press',
                        isLive && 'opacity-50 pointer-events-none'
                    )} style={{ background: 'var(--ink-1)' }}>
                        <input type="file" accept="image/*" className="sr-only" onChange={handleCoverImageChange} disabled={isLive} />
                        {coverImageUrl ? (
                            <img src={coverImageUrl} alt="Cover" className="w-24 h-24 object-cover shrink-0" />
                        ) : (
                            <div className="w-24 h-24 grid place-items-center shrink-0" style={{ background: 'var(--ink-2)' }}>
                                <ImageIcon className="size-8" style={{ color: 'var(--fg-3)' }} />
                            </div>
                        )}
                        <div className="flex-1 min-w-0 px-4">
                            {coverUploading ? (
                                <div className="flex items-center gap-2" style={{ color: 'var(--fg-2)' }}>
                                    <Loader2 className="size-4 animate-spin" />
                                    <span className="text-[13px]">Uploading…</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-[13px] text-white">
                                        <Upload className="size-3.5" />
                                        {coverImageUrl ? 'Change cover image' : 'Upload cover image'}
                                    </div>
                                    <p className="mono text-[10px] mt-1" style={{ color: 'var(--fg-3)' }}>JPG, PNG, WebP · max 5 MB</p>
                                </>
                            )}
                        </div>
                        {coverImageUrl && !coverUploading && (
                            <button type="button" onClick={e => { e.preventDefault(); setCoverImageUrl(null); setCoverImageKey(null); }}
                                className="mr-4 shrink-0 press" style={{ color: 'var(--fg-3)' }}>
                                <X className="size-4" />
                            </button>
                        )}
                    </label>
                </div>

                <div>
                    <FieldLabel>Channel name</FieldLabel>
                    <Input value={title} onChange={e => setTitle(e.target.value)} disabled={isLive}
                        placeholder="e.g. Late Night Vibes"
                        className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                </div>

                <div>
                    <FieldLabel>Description <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(optional)</span></FieldLabel>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={isLive}
                        rows={2} placeholder="What kind of music do you play?"
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] text-white outline-none resize-none disabled:opacity-50 placeholder:text-white/25 focus:ring-2 focus:ring-white/15 border border-white/10"
                        style={{ background: 'var(--ink-1)' }} />
                </div>

                <div>
                    <FieldLabel><Tag className="size-3 inline mr-1 -mt-px" />Room tags <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(pick genres / moods)</span></FieldLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {ALL_TAGS.map(tag => (
                            <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                className={cn(
                                    'h-7 px-3 rounded-full mono text-[10px] uppercase tracking-wider transition-all press',
                                    selectedTags.includes(tag)
                                        ? 'bg-white/15 text-white ring-1 ring-white/25'
                                        : 'ring-1 ring-white/10 hover:ring-white/20'
                                )}
                                style={{ color: selectedTags.includes(tag) ? undefined : 'var(--fg-3)' }}>
                                {tag}
                            </button>
                        ))}
                    </div>
                    {selectedTags.length > 0 && (
                        <p className="mono text-[10px] mt-2" style={{ color: 'var(--fg-3)' }}>
                            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between py-0.5 border-t hair">
                    <div>
                        <p className="text-[13px] text-white">Public channel</p>
                        <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Visible on discovery when live</p>
                    </div>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLive} />
                </div>

                <div>
                    <FieldLabel>Stream goal <span className="normal-case font-normal" style={{ color: 'var(--fg-3)' }}>(coins, optional)</span></FieldLabel>
                    <Input type="number" min="1" step="1" value={streamGoal} onChange={e => setStreamGoal(e.target.value)} disabled={isLive}
                        placeholder="e.g. 1000"
                        className="bg-white/5 border-white/10 disabled:opacity-50 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                    <p className="mono text-[10px] mt-1.5" style={{ color: 'var(--fg-3)' }}>Resets on each go-live.</p>
                </div>
            </Card>

            <Card className="space-y-4">
                <div className="flex items-center justify-between">
                    <SectionHead label="Playlist" />
                    <button type="button" onClick={onNavigateToPlaylists}
                        className="mono text-[10px] press hover:text-white transition-colors" style={{ color: 'var(--fg-3)' }}>
                        Manage saved playlists →
                    </button>
                </div>
                {songsLoading ? <Skeleton className="h-48 bg-white/5 rounded-xl" /> : (
                    <SongSelector songs={songs} selectedIds={selectedIds} onChange={setSelectedIds} disabled={isLive} />
                )}
            </Card>

            {error && <p className="text-[13px] text-[oklch(0.72_0.22_20)]">{error}</p>}

            {!isLive && (
                <button type="submit" disabled={saving}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold disabled:opacity-50 press">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {hasRoom ? 'Save Changes' : 'Create Channel'}
                </button>
            )}

            {hasRoom && (
                <Card className="space-y-4">
                    <SectionHead label="Room Features" sub="Toggle what listeners can see and do. Changes apply immediately to live rooms." />
                    <div className="space-y-0 divide-y hair">
                        {([
                            { key: 'liveMic', label: 'Live Mic', desc: 'Broadcast voice between songs' },
                            { key: 'broadcasts', label: 'Broadcast Assets', desc: 'Play pre-recorded clips' },
                            { key: 'chat', label: 'Live Chat', desc: 'Listeners can send messages' },
                            { key: 'voting', label: 'Vote to Skip', desc: 'Listeners can vote to skip' },
                            { key: 'voteQueue', label: 'Vote Queue', desc: 'Listeners nominate & vote songs in' },
                            { key: 'donations', label: 'Donations', desc: 'Listeners can send you coins' },
                            { key: 'minigames', label: 'Minigames', desc: 'Listeners see minigame panels' },
                        ] as { key: keyof RoomFeatureFlags; label: string; desc: string }[]).map(({ key, label, desc }) => (
                            <div key={key} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-[13px] text-white">{label}</p>
                                    <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{desc}</p>
                                </div>
                                <Switch
                                    checked={featureFlags[key]}
                                    onCheckedChange={val => setFeatureFlags(f => ({ ...f, [key]: val }))}
                                />
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleSaveFlags} disabled={savingFlags}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 press"
                        style={{ background: 'oklch(0.55 0.18 295)' }}>
                        {savingFlags ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Save Features
                    </button>
                </Card>
            )}
        </form>
    );
};
