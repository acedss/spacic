import { useCallback, useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Plus, Check, X, Trash2 } from 'lucide-react';
import { AdminPageHeader, AdminPills } from '../admin-ui';
import { ArtistDetailSheet, AlbumDetailSheet } from '../admin-detail-sheets';
import { getAxiosErrorMessage } from '../admin-shared';

interface ArtistRow { _id: string; name: string; bio?: string; imageUrl?: string | null; songCount?: number; createdAt?: string; }
interface AlbumRow { _id: string; title: string; artistId?: { _id: string; name: string } | null; artistName?: string; coverImageUrl?: string | null; releaseYear?: number | null; createdAt?: string; }

export const CatalogSection = () => {
    const [tab, setTab] = useState<'artists' | 'albums'>('artists');
    const [detailArtistId, setDetailArtistId] = useState<string | null>(null);
    const [detailAlbumId, setDetailAlbumId] = useState<string | null>(null);

    const [artists, setArtists] = useState<ArtistRow[]>([]);
    const [artistsLoading, setArtistsLoading] = useState(true);
    const [artistSearch, setArtistSearch] = useState('');
    const [showArtistForm, setShowArtistForm] = useState(false);
    const [artistDraft, setArtistDraft] = useState({ name: '', bio: '', imageUrl: '' });
    const [savingArtist, setSavingArtist] = useState(false);

    const [albums, setAlbums] = useState<AlbumRow[]>([]);
    const [albumsLoading, setAlbumsLoading] = useState(true);
    const [albumSearch, setAlbumSearch] = useState('');
    const [showAlbumForm, setShowAlbumForm] = useState(false);
    const [albumDraft, setAlbumDraft] = useState({ title: '', artistId: '', coverImageUrl: '', releaseYear: '' });
    const [savingAlbum, setSavingAlbum] = useState(false);

    const fetchArtists = useCallback(async (search = '') => {
        setArtistsLoading(true);
        try {
            const { data } = await axiosInstance.get('/admin/artists', { params: { search: search || undefined } });
            setArtists(data.data);
        } catch { toast.error('Failed to load artists'); }
        finally { setArtistsLoading(false); }
    }, []);

    const fetchAlbums = useCallback(async (search = '') => {
        setAlbumsLoading(true);
        try {
            const { data } = await axiosInstance.get('/admin/albums', { params: { search: search || undefined } });
            setAlbums(data.data);
        } catch { toast.error('Failed to load albums'); }
        finally { setAlbumsLoading(false); }
    }, []);

    useEffect(() => { fetchArtists(); fetchAlbums(); }, [fetchArtists, fetchAlbums]);

    useEffect(() => {
        const t = setTimeout(() => fetchArtists(artistSearch), 250);
        return () => clearTimeout(t);
    }, [artistSearch, fetchArtists]);
    useEffect(() => {
        const t = setTimeout(() => fetchAlbums(albumSearch), 250);
        return () => clearTimeout(t);
    }, [albumSearch, fetchAlbums]);

    const createArtist = async () => {
        const name = artistDraft.name.trim();
        if (!name) return toast.error('Name is required');
        setSavingArtist(true);
        try {
            await axiosInstance.post('/admin/artists', { name, bio: artistDraft.bio.trim(), imageUrl: artistDraft.imageUrl.trim() || null });
            toast.success(`Artist "${name}" created`);
            setArtistDraft({ name: '', bio: '', imageUrl: '' });
            setShowArtistForm(false);
            fetchArtists(artistSearch);
        } catch (err) {
            toast.error(getAxiosErrorMessage(err, 'Create failed'));
        } finally { setSavingArtist(false); }
    };

    const deleteArtist = async (id: string, name: string) => {
        if (!confirm(`Delete artist "${name}"? Albums will be detached.`)) return;
        try {
            await axiosInstance.delete(`/admin/artists/${id}`);
            toast.success('Artist deleted');
            fetchArtists(artistSearch);
            fetchAlbums(albumSearch);
        } catch (err) {
            toast.error(getAxiosErrorMessage(err, 'Delete failed'));
        }
    };

    const createAlbum = async () => {
        const title = albumDraft.title.trim();
        if (!title) return toast.error('Title is required');
        setSavingAlbum(true);
        try {
            await axiosInstance.post('/admin/albums', {
                title,
                artistId: albumDraft.artistId || null,
                coverImageUrl: albumDraft.coverImageUrl.trim() || null,
                releaseYear: albumDraft.releaseYear ? Number(albumDraft.releaseYear) : null,
            });
            toast.success(`Album "${title}" created`);
            setAlbumDraft({ title: '', artistId: '', coverImageUrl: '', releaseYear: '' });
            setShowAlbumForm(false);
            fetchAlbums(albumSearch);
        } catch (err) {
            toast.error(getAxiosErrorMessage(err, 'Create failed'));
        } finally { setSavingAlbum(false); }
    };

    const deleteAlbum = async (id: string, title: string) => {
        if (!confirm(`Delete album "${title}"? Songs will be detached.`)) return;
        try {
            await axiosInstance.delete(`/admin/albums/${id}`);
            toast.success('Album deleted');
            fetchAlbums(albumSearch);
        } catch (err) {
            toast.error(getAxiosErrorMessage(err, 'Delete failed'));
        }
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Catalog"
                title="Artists & Albums"
                description="Manage artist profiles and album groupings. Songs reference these entities for browsing, RecSys, and library navigation."
            />

            <AdminPills<'artists' | 'albums'>
                ariaLabel="Catalog sub-section"
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'artists', label: 'Artists', count: artists.length },
                    { value: 'albums',  label: 'Albums',  count: albums.length },
                ]}
            />

            {tab === 'artists' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Search artists…"
                            value={artistSearch}
                            onChange={e => setArtistSearch(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-8 text-xs flex-1"
                        />
                        <Button size="sm" onClick={() => setShowArtistForm(s => !s)}
                            className="bg-white/10 hover:bg-white/15 text-white gap-1.5">
                            <Plus className="size-3.5" /> New artist
                        </Button>
                    </div>

                    {showArtistForm && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <Input placeholder="Name" value={artistDraft.name}
                                onChange={e => setArtistDraft(d => ({ ...d, name: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white text-xs h-8" />
                            <div className="flex items-center gap-3">
                                {artistDraft.imageUrl ? (
                                    <img src={artistDraft.imageUrl} alt="" className="size-12 rounded-full object-cover ring-1 ring-white/10" />
                                ) : (
                                    <div className="size-12 rounded-full bg-white/5 ring-1 ring-white/10" />
                                )}
                                <Input placeholder="Image URL — or upload" value={artistDraft.imageUrl}
                                    onChange={e => setArtistDraft(d => ({ ...d, imageUrl: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1" />
                                <label className="text-xs px-3 py-1.5 rounded-md ring-1 ring-white/10 bg-white/5 hover:bg-white/10 cursor-pointer text-zinc-300">
                                    Upload
                                    <input type="file" accept="image/*" hidden
                                        onChange={async e => {
                                            const f = e.target.files?.[0]; e.target.value = '';
                                            if (!f) return;
                                            try {
                                                const fd = new FormData(); fd.append('image', f);
                                                const { data } = await axiosInstance.post('/admin/artists/image-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                setArtistDraft(d => ({ ...d, imageUrl: data.data.presignedUrl }));
                                                toast.success('Image uploaded');
                                            } catch (err) { toast.error(getAxiosErrorMessage(err, 'Upload failed')); }
                                        }} />
                                </label>
                            </div>
                            <textarea placeholder="Bio (optional)" value={artistDraft.bio}
                                onChange={e => setArtistDraft(d => ({ ...d, bio: e.target.value }))}
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded text-white text-xs px-3 py-2 placeholder:text-zinc-600" />
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setShowArtistForm(false)} className="text-zinc-400"><X className="size-3.5" /></Button>
                                <Button size="sm" onClick={createArtist} disabled={savingArtist} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
                                    {savingArtist ? <Loader className="size-3 animate-spin" /> : <Check className="size-3.5" />} Save
                                </Button>
                            </div>
                        </div>
                    )}

                    {artistsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>
                    ) : artists.length === 0 ? (
                        <p className="text-zinc-600 text-sm text-center py-8">No artists yet.</p>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            {artists.map((a, i) => (
                                <div key={a._id} className={cn('flex items-center gap-3 px-3 py-2 text-xs', i > 0 && 'border-t border-white/5')}>
                                    {a.imageUrl
                                        ? <img src={a.imageUrl} className="size-8 rounded-full object-cover" />
                                        : <div className="size-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">{a.name[0]?.toUpperCase()}</div>}
                                    <button onClick={() => setDetailArtistId(a._id)} className="flex-1 min-w-0 text-left hover:underline">
                                        <p className="text-white">{a.name}</p>
                                        {a.bio && <p className="text-zinc-500 truncate text-[11px]">{a.bio}</p>}
                                    </button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteArtist(a._id, a.name)}
                                        className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 size-7 p-0">
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'albums' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Search albums…"
                            value={albumSearch}
                            onChange={e => setAlbumSearch(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-8 text-xs flex-1"
                        />
                        <Button size="sm" onClick={() => setShowAlbumForm(s => !s)}
                            className="bg-white/10 hover:bg-white/15 text-white gap-1.5">
                            <Plus className="size-3.5" /> New album
                        </Button>
                    </div>

                    {showAlbumForm && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <Input placeholder="Title" value={albumDraft.title}
                                onChange={e => setAlbumDraft(d => ({ ...d, title: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white text-xs h-8" />
                            <select value={albumDraft.artistId}
                                onChange={e => setAlbumDraft(d => ({ ...d, artistId: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded text-white text-xs h-8 px-2">
                                <option value="">— No artist —</option>
                                {artists.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                            </select>
                            <div className="flex items-center gap-3">
                                {albumDraft.coverImageUrl ? (
                                    <img src={albumDraft.coverImageUrl} alt="" className="size-12 rounded-md object-cover ring-1 ring-white/10" />
                                ) : (
                                    <div className="size-12 rounded-md bg-white/5 ring-1 ring-white/10" />
                                )}
                                <Input placeholder="Cover URL — or upload" value={albumDraft.coverImageUrl}
                                    onChange={e => setAlbumDraft(d => ({ ...d, coverImageUrl: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1" />
                                <label className="text-xs px-3 py-1.5 rounded-md ring-1 ring-white/10 bg-white/5 hover:bg-white/10 cursor-pointer text-zinc-300">
                                    Upload
                                    <input type="file" accept="image/*" hidden
                                        onChange={async e => {
                                            const f = e.target.files?.[0]; e.target.value = '';
                                            if (!f) return;
                                            try {
                                                const fd = new FormData(); fd.append('image', f);
                                                const { data } = await axiosInstance.post('/admin/albums/image-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                setAlbumDraft(d => ({ ...d, coverImageUrl: data.data.presignedUrl }));
                                                toast.success('Cover uploaded');
                                            } catch (err) { toast.error(getAxiosErrorMessage(err, 'Upload failed')); }
                                        }} />
                                </label>
                            </div>
                            <Input type="number" placeholder="Release year (optional)" value={albumDraft.releaseYear}
                                onChange={e => setAlbumDraft(d => ({ ...d, releaseYear: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white text-xs h-8" />
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setShowAlbumForm(false)} className="text-zinc-400"><X className="size-3.5" /></Button>
                                <Button size="sm" onClick={createAlbum} disabled={savingAlbum} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
                                    {savingAlbum ? <Loader className="size-3 animate-spin" /> : <Check className="size-3.5" />} Save
                                </Button>
                            </div>
                        </div>
                    )}

                    {albumsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>
                    ) : albums.length === 0 ? (
                        <p className="text-zinc-600 text-sm text-center py-8">No albums yet.</p>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            {albums.map((a, i) => (
                                <div key={a._id} className={cn('flex items-center gap-3 px-3 py-2 text-xs', i > 0 && 'border-t border-white/5')}>
                                    {a.coverImageUrl
                                        ? <img src={a.coverImageUrl} className="size-8 rounded object-cover" />
                                        : <div className="size-8 rounded bg-white/5" />}
                                    <button onClick={() => setDetailAlbumId(a._id)} className="flex-1 min-w-0 text-left hover:underline">
                                        <p className="text-white truncate">{a.title}</p>
                                        <p className="text-zinc-500 text-[11px]">
                                            {a.artistId?.name ?? a.artistName ?? '— Unattached —'}
                                            {a.releaseYear && ` · ${a.releaseYear}`}
                                        </p>
                                    </button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteAlbum(a._id, a.title)}
                                        className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 size-7 p-0">
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <ArtistDetailSheet id={detailArtistId} onClose={() => setDetailArtistId(null)} />
            <AlbumDetailSheet id={detailAlbumId} onClose={() => setDetailAlbumId(null)} />
        </div>
    );
};
