import { useState, useEffect, useCallback } from 'react';
import { Search, Radio, Music, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getPublicRooms, getSongs } from '@/lib/roomService';
import type { RoomInfo, Song } from '@/types/types';
import { cn } from '@/lib/utils';
import { SongResultCard } from './components/SongResultCard';
import { RoomResultCard } from './components/RoomResultCard';

type Tab = 'all' | 'rooms' | 'songs';

const SearchPage = () => {
    const [query, setQuery]                   = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [tab, setTab]                       = useState<Tab>('all');
    const [rooms, setRooms]                   = useState<RoomInfo[]>([]);
    const [songs, setSongs]                   = useState<Song[]>([]);
    const [loading, setLoading]               = useState(false);
    const [allSongs, setAllSongs]             = useState<Song[]>([]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        getSongs(true).then(setAllSongs).catch(() => {});
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setRooms([]); setSongs([]); return; }
        setLoading(true);
        try {
            const lower = q.toLowerCase();
            const roomResult = await getPublicRooms({ search: q, limit: 20 });
            setRooms(roomResult.data ?? []);
            setSongs(
                allSongs.filter(s =>
                    s.title.toLowerCase().includes(lower) ||
                    s.artist.toLowerCase().includes(lower)
                ).slice(0, 20)
            );
        } catch {
            // keep previous results
        } finally {
            setLoading(false);
        }
    }, [allSongs]);

    useEffect(() => {
        doSearch(debouncedQuery);
    }, [debouncedQuery, doSearch]);

    const hasQuery     = debouncedQuery.trim().length > 0;
    const showRooms    = (tab === 'all' || tab === 'rooms') && rooms.length > 0;
    const showSongs    = (tab === 'all' || tab === 'songs') && songs.length > 0;
    const noResults    = hasQuery && !loading && rooms.length === 0 && songs.length === 0;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
                {loading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500 animate-spin" />
                )}
                <Input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search rooms, songs, artists…"
                    className="pl-12 pr-10 h-12 text-base bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 rounded-2xl"
                />
            </div>

            {hasQuery && (rooms.length > 0 || songs.length > 0) && (
                <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1 w-fit">
                    {(['all', 'rooms', 'songs'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                'text-xs px-3 py-1.5 rounded-lg capitalize transition-all',
                                tab === t ? 'bg-white/10 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            {t === 'all'
                                ? `All (${rooms.length + songs.length})`
                                : t === 'rooms'
                                    ? `Rooms (${rooms.length})`
                                    : `Songs (${songs.length})`
                            }
                        </button>
                    ))}
                </div>
            )}

            {noResults && (
                <div className="text-center py-16">
                    <Search className="size-8 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400">No results for "{debouncedQuery}"</p>
                    <p className="text-zinc-600 text-sm mt-1">Try a different room name or artist</p>
                </div>
            )}

            {!hasQuery && (
                <div className="text-center py-16 space-y-3">
                    <Search className="size-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400 font-medium">Search Spacic</p>
                    <p className="text-zinc-600 text-sm">Find live rooms, songs, and artists</p>
                </div>
            )}

            {showRooms && (
                <section className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Radio className="size-3" /> Rooms
                    </p>
                    <div className="space-y-1.5">
                        {rooms.map(r => <RoomResultCard key={r._id} room={r} />)}
                    </div>
                </section>
            )}

            {showSongs && (
                <section className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Music className="size-3" /> Songs
                    </p>
                    <div className="space-y-1.5">
                        {songs.map(s => <SongResultCard key={s._id} song={s} />)}
                    </div>
                </section>
            )}
        </div>
    );
};

export default SearchPage;
