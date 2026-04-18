import { useState } from 'react';
import { ChevronUp, Search, Music2 } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { axiosInstance } from '@/lib/axios';
import { Button } from '@/components/ui/button';

interface Props {
    onNominate: (songId: string) => void;
    onVote:     (songId: string) => void;
}

interface SongResult {
    _id: string;
    title: string;
    artist: string;
    imageUrl: string;
}

export const NominationsPanel = ({ onNominate, onVote }: Props) => {
    const { nominations } = useRoomStore();
    const [search, setSearch]     = useState('');
    const [results, setResults]   = useState<SongResult[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async () => {
        if (!search.trim()) return;
        setSearching(true);
        try {
            const { data } = await axiosInstance.get('/songs', { params: { search: search.trim(), limit: 10 } });
            setResults(data.data ?? data ?? []);
        } catch { setResults([]); }
        setSearching(false);
    };

    return (
        <div className="flex flex-col h-full p-3 gap-3">
            {/* Search to nominate */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search songs to nominate..."
                        className="w-full pl-7 pr-2 py-1.5 bg-zinc-800 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                    />
                </div>
                <Button onClick={handleSearch} size="sm" variant="ghost" className="bg-violet-600/80 hover:bg-violet-500 text-white text-xs px-3">
                    {searching ? '...' : 'Search'}
                </Button>
            </div>

            {/* Search results */}
            {results.length > 0 && (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {results.map((song) => (
                        <button
                            key={song._id}
                            onClick={() => { onNominate(song._id); setResults([]); setSearch(''); }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-left"
                        >
                            <Music2 className="size-3 text-zinc-500 flex-shrink-0" />
                            <span className="text-xs text-white truncate">{song.title}</span>
                            <span className="text-[10px] text-zinc-500 truncate">{song.artist}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Active nominations */}
            <div className="flex-1 overflow-y-auto">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                    Nominations ({nominations.length})
                </p>
                {nominations.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-4">No nominations yet — search and nominate a song!</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {nominations.map((nom) => (
                            <div key={nom.songId} className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded-lg border border-white/5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">{nom.title}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{nom.artist} · by {nom.nominatorName}</p>
                                </div>
                                <button
                                    onClick={() => onVote(nom.songId)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 text-xs transition-colors flex-shrink-0"
                                >
                                    <ChevronUp className="size-3" />
                                    {nom.votes}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
