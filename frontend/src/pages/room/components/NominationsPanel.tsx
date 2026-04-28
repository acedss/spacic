import { useState } from 'react';
import { ChevronUp, Search, Music2, Plus, Send } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { axiosInstance } from '@/lib/axios';

interface Props {
    onNominate:     (songId: string) => void;
    onVote:         (songId: string) => void;
    onRequestSong:  (request: string) => void;
}

interface SongResult {
    _id:      string;
    title:    string;
    artist:   string;
    imageUrl: string;
}

export const NominationsPanel = ({ onNominate, onVote, onRequestSong }: Props) => {
    const { nominations, listenerCount, sessionInfo, room } = useRoomStore();
    const currentSongIndex = usePlayerStore((s) => s.currentSongIndex);
    // Upcoming songs already on the playlist — exclude the currently-playing one,
    // cap at 5 so the panel stays scannable without scrolling.
    const upcoming = room?.playlist
        ? room.playlist.slice(currentSongIndex + 1, currentSongIndex + 6)
        : [];
    const [search, setSearch]         = useState('');
    const [results, setResults]       = useState<SongResult[]>([]);
    const [searching, setSearching]   = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [requestText, setRequestText] = useState('');
    const [showRequest, setShowRequest] = useState(false);

    // Votes needed to add a song to the queue (mirrors backend formula)
    const needed = Math.max(1, Math.ceil(listenerCount * (sessionInfo?.voteThresholdPercent ?? 50) / 100));

    const handleSearch = async () => {
        if (!search.trim()) return;
        setSearching(true);
        try {
            const { data } = await axiosInstance.get('/songs', { params: { search: search.trim(), limit: 8 } });
            setResults(data.data ?? data ?? []);
        } catch { setResults([]); }
        setSearching(false);
    };

    const handleRequest = () => {
        if (!requestText.trim()) return;
        onRequestSong(requestText.trim());
        setRequestText('');
        setShowRequest(false);
    };

    const maxVotes = nominations.length > 0 ? Math.max(...nominations.map(n => n.votes), 1) : 1;

    return (
        <div className="flex flex-col gap-3 p-4">
            {/* Coming up from the playlist (auto-plays next, no voting needed) */}
            {upcoming.length > 0 && (
                <div className="space-y-1.5">
                    <p className="mono text-[9px] uppercase tracking-widest px-1" style={{ color: 'var(--fg-3)' }}>
                        Coming up · Playlist
                    </p>
                    <div className="rounded-xl ring-1 ring-white/8 overflow-hidden divide-y divide-white/5"
                         style={{ background: 'var(--ink-2)' }}>
                        {upcoming.map((song, i) => (
                            <div key={song._id} className="flex items-center gap-2.5 px-3 py-2">
                                <span className="mono text-[10px] w-4 tabular-nums" style={{ color: 'var(--fg-3)' }}>
                                    {i + 1}
                                </span>
                                {song.imageUrl ? (
                                    <img src={song.imageUrl} className="w-7 h-7 rounded-md object-cover shrink-0" alt="" />
                                ) : (
                                    <div className="w-7 h-7 rounded-md grid place-items-center shrink-0 bg-white/8">
                                        <Music2 className="size-3 text-white/40" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] text-white truncate">{song.title}</p>
                                    <p className="text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>{song.artist}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => { setShowSearch(v => !v); setShowRequest(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl ring-1 ring-white/12 text-[12px] hover:bg-white/6 press transition-colors"
                    style={{ color: 'var(--fg-2)' }}>
                    <Plus className="size-3.5" /> Nominate
                </button>
                <button
                    onClick={() => { setShowRequest(v => !v); setShowSearch(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl ring-1 ring-white/12 text-[12px] hover:bg-white/6 press transition-colors"
                    style={{ color: 'var(--fg-2)' }}>
                    <Send className="size-3.5" /> Request
                </button>
            </div>

            {/* Nominate: search + pick from catalog */}
            {showSearch && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--fg-3)' }} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search songs…"
                                className="w-full pl-8 pr-2 h-9 rounded-xl bg-white/6 ring-1 ring-white/10 text-[12px] text-white placeholder:text-[var(--fg-3)] outline-none focus:ring-[oklch(0.68_0.21_295_/_0.5)]"
                            />
                        </div>
                        <button onClick={handleSearch}
                            className="h-9 px-3 rounded-xl text-[12px] font-medium press bg-[oklch(0.68_0.21_295)] text-white">
                            {searching ? '…' : 'Go'}
                        </button>
                    </div>

                    {results.length > 0 && (
                        <div className="rounded-xl ring-1 ring-white/8 overflow-hidden divide-y divide-white/5" style={{ background: 'var(--ink-2)' }}>
                            {results.map((song) => (
                                <button key={song._id}
                                    onClick={() => { onNominate(song._id); setResults([]); setSearch(''); setShowSearch(false); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/5 text-left transition-colors">
                                    {song.imageUrl ? (
                                        <img src={song.imageUrl} className="w-8 h-8 rounded-md object-cover shrink-0" alt="" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-md grid place-items-center shrink-0 bg-white/8">
                                            <Music2 className="size-3.5 text-white/40" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-[12px] text-white truncate">{song.title}</p>
                                        <p className="text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>{song.artist}</p>
                                    </div>
                                    <Plus className="size-3.5 ml-auto shrink-0 opacity-40" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Request: free-text song request → sent as chat message */}
            {showRequest && (
                <div className="flex gap-2">
                    <input
                        value={requestText}
                        onChange={(e) => setRequestText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRequest()}
                        placeholder="Song name or artist to request…"
                        className="flex-1 px-3 h-9 rounded-xl bg-white/6 ring-1 ring-white/10 text-[12px] text-white placeholder:text-[var(--fg-3)] outline-none focus:ring-[oklch(0.68_0.21_295_/_0.5)]"
                    />
                    <button onClick={handleRequest}
                        className="h-9 px-3 rounded-xl text-[12px] font-medium press bg-[oklch(0.68_0.21_295)] text-white">
                        <Send className="size-3.5" />
                    </button>
                </div>
            )}

            {/* Active nominations */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                    <p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                        Vote-to-Queue · {nominations.length} nominated
                    </p>
                    <p className="mono text-[9px]" style={{ color: 'var(--fg-3)' }}>
                        {needed} votes to add
                    </p>
                </div>

                {nominations.length === 0 ? (
                    <div className="py-6 text-center">
                        <Music2 className="size-6 mx-auto mb-2 opacity-20 text-white" />
                        <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>No nominations yet</p>
                    </div>
                ) : (
                    nominations.map((nom, i) => {
                        const pct      = (nom.votes / maxVotes) * 100;
                        const votePct  = Math.min(100, (nom.votes / needed) * 100);
                        const remaining = Math.max(0, needed - nom.votes);
                        return (
                            <div key={nom.songId}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors relative overflow-hidden">
                                {/* Relative vote strength bg */}
                                <div className="absolute inset-0 rounded-xl opacity-30"
                                     style={{ width: `${pct}%`, background: 'linear-gradient(90deg, oklch(0.68 0.21 295 / 0.2), transparent)' }} />

                                <span className="mono text-[10px] w-4 tabular-nums relative" style={{ color: 'var(--fg-3)' }}>{i + 1}</span>
                                <div className="flex-1 min-w-0 relative">
                                    <p className="text-[13px] text-white truncate">{nom.title}</p>
                                    <p className="text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>
                                        {nom.artist} · by {nom.nominatorName}
                                    </p>
                                    {/* Threshold progress bar */}
                                    <div className="mt-1 h-0.5 bg-white/8 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${votePct}%`,
                                                background: votePct >= 100 ? 'oklch(0.74 0.14 160)' : 'oklch(0.68 0.21 295)',
                                            }} />
                                    </div>
                                    {remaining > 0 && (
                                        <p className="mono text-[9px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{remaining} more to queue</p>
                                    )}
                                </div>
                                <button onClick={() => onVote(nom.songId)}
                                    className="relative flex-shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] mono tabular-nums press ring-1 ring-[oklch(0.68_0.21_295_/_0.3)] bg-[oklch(0.68_0.21_295_/_0.12)] text-[oklch(0.82_0.14_295)] hover:bg-[oklch(0.68_0.21_295_/_0.25)]">
                                    <ChevronUp className="size-3" />
                                    {nom.votes}/{needed}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
