import { useState } from 'react';
import { Check, Clock, Gem, Heart, Link2, Music2, Radio, Users } from 'lucide-react';
import type { RoomInfo } from '@/types/types';

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const RoomOfflineView = ({ room, onBack }: { room: RoomInfo; onBack: () => void }) => {
    const [recapCopied, setRecapCopied] = useState(false);
    const s = room.stats;
    const stats = [
        { icon: Users, label: 'Listeners', value: s?.totalListeners?.toLocaleString() ?? '0' },
        { icon: Clock, label: 'Time Played', value: toHours(s?.totalMinutesListened ?? 0) },
        { icon: Gem, label: 'Coins Earned', value: s?.totalCoinsEarned?.toLocaleString() ?? '0' },
        { icon: Users, label: 'Unique Donors', value: s?.totalDonors?.toLocaleString() ?? '0' },
        { icon: Heart, label: 'Favorites', value: room.favoriteCount?.toLocaleString() ?? '0' },
        { icon: Radio, label: 'Sessions Hosted', value: s?.totalSessions?.toLocaleString() ?? '0' },
    ];

    const topSongs = (room.playlist ?? []).slice(0, 5);

    const handleCopyRecap = () => {
        navigator.clipboard.writeText(window.location.href).catch(() => { });
        setRecapCopied(true);
        setTimeout(() => setRecapCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-full py-14 px-8 gap-8 overflow-auto hide-scrollbar" style={{ background: 'var(--ink-0)' }}>
            <div className="text-center space-y-2 max-w-lg w-full">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Session ended · Replay available</span>
                </div>
                <h1 className="serif text-white leading-tight" style={{ fontSize: 44 }}>{room.title}</h1>
                {room.description && (
                    <p className="text-[14px] max-w-md mx-auto leading-relaxed" style={{ color: 'var(--fg-2)' }}>{room.description}</p>
                )}
                <button onClick={handleCopyRecap}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] ring-1 ring-white/15 hover:bg-white/8 press transition-colors mt-2"
                    style={{ color: 'var(--fg-2)' }}>
                    {recapCopied ? <Check className="size-3.5 text-[oklch(0.74_0.14_160)]" /> : <Link2 className="size-3.5" />}
                    {recapCopied ? 'Link copied!' : 'Share recap'}
                </button>
            </div>

            {s && (
                <div className="w-full max-w-lg grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stats.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-xl p-4 ring-1 ring-white/8" style={{ background: 'var(--ink-2)' }}>
                            <Icon className="size-4 mb-2 opacity-50 text-white" />
                            <p className="mono text-[22px] text-white tabular-nums leading-none">{value}</p>
                            <p className="mono text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {topSongs.length > 0 && (
                <div className="w-full max-w-lg">
                    <p className="mono text-[9px] uppercase tracking-widest mb-3" style={{ color: 'var(--fg-3)' }}>Tracks played this session</p>
                    <div className="rounded-2xl ring-1 ring-white/8 overflow-hidden divide-y divide-white/5" style={{ background: 'var(--ink-2)' }}>
                        {topSongs.map((song, i) => (
                            <div key={song._id ?? i} className="flex items-center gap-3 px-4 py-3">
                                <span className="mono text-[10px] w-4 tabular-nums" style={{ color: 'var(--fg-3)' }}>{i + 1}</span>
                                {song.imageUrl ? (
                                    <img src={song.imageUrl} className="w-9 h-9 rounded-lg object-cover shrink-0" alt="" />
                                ) : (
                                    <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-white/8">
                                        <Music2 className="size-4 text-white/30" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-white truncate">{song.title}</p>
                                    <p className="text-[11px] truncate" style={{ color: 'var(--fg-3)' }}>{song.artist}</p>
                                </div>
                                <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                                    {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>Check back when the creator goes live.</p>
            <button onClick={onBack} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                Find Live Rooms
            </button>
        </div>
    );
};
