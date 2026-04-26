import { useNavigate } from 'react-router-dom';
import { UserMinus, Users, Radio, Clock, Mic2 } from 'lucide-react';
import type { RoomInfo } from '@/types/types';
import { cn } from '@/lib/utils';

const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
    :                 String(n);

interface Props {
    room: RoomInfo;
    onUnfollow: () => void;
}

export const CreatorCard = ({ room, onUnfollow }: Props) => {
    const navigate = useNavigate();
    const creator  = (room as unknown as { creatorId?: { fullName?: string; imageUrl?: string } }).creatorId ?? null;
    const isLive   = room.status === 'live';
    const coverImg = (room.playlist as Array<{ imageUrl?: string }>)?.[0]?.imageUrl ?? '';
    const s = room.stats;
    const hrs  = Math.round((s?.totalMinutesListened ?? 0) / 60);

    return (
        <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden glass">
            <div className="relative h-36 overflow-hidden">
                {coverImg
                    ? <img src={coverImg} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full" style={{ background: 'oklch(0.2 0.06 295)' }} />
                }
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0.7) 100%)' }} />

                {isLive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[oklch(0.72_0.22_20_/_0.9)] text-white">
                        <span className="live-dot" style={{ width: 5, height: 5 }} />
                        Live Now · {(room.listenerCount ?? 0).toLocaleString()} listening
                    </div>
                )}

                <div className="absolute bottom-3 left-4 right-4">
                    <p className="mono text-[9px] uppercase tracking-widest text-white/50 mb-0.5">Creator Station</p>
                    <h3 className="serif italic text-white text-[22px] leading-tight truncate">{room.title}</h3>
                </div>
            </div>

            <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b hair">
                {creator?.imageUrl
                    ? <img src={creator.imageUrl} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/15 shrink-0" alt="" />
                    : <div className="w-10 h-10 rounded-full shrink-0 bg-white/10 grid place-items-center"><Mic2 className="size-4 text-white/40" /></div>
                }
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-white font-medium truncate">{creator?.fullName ?? 'Creator'}</p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
                        Creator · {room.favoriteCount.toLocaleString()} followers
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(`/rooms/${room._id}`)}
                        className={cn(
                            'h-8 px-4 rounded-xl text-[12px] font-semibold press transition-all',
                            isLive
                                ? 'bg-[oklch(0.72_0.22_20)] text-white'
                                : 'bg-white text-[var(--ink-0)]'
                        )}>
                        {isLive ? 'Join Live' : 'Visit'}
                    </button>
                    <button
                        onClick={onUnfollow}
                        title="Unfollow"
                        className="h-8 w-8 rounded-xl grid place-items-center ring-1 ring-white/12 hover:bg-[oklch(0.72_0.22_20_/_0.12)] hover:ring-[oklch(0.72_0.22_20_/_0.4)] press transition-all"
                        style={{ color: 'var(--fg-3)' }}>
                        <UserMinus className="size-3.5" />
                    </button>
                </div>
            </div>

            {s && (
                <div className="grid grid-cols-3 divide-x divide-white/6 px-4 py-3">
                    {[
                        { icon: Radio, label: 'Rooms Hosted',       value: fmt(s.totalSessions ?? 0) },
                        { icon: Users, label: 'Listeners Reached',  value: fmt(s.totalListeners ?? 0) },
                        { icon: Clock, label: 'Hrs Streamed',        value: fmt(hrs) },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center gap-0.5 px-2">
                            <p className="mono text-[18px] text-white tabular-nums font-semibold leading-none">{value}</p>
                            <p className="mono text-[8px] uppercase tracking-widest text-center" style={{ color: 'var(--fg-3)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {room.description && (
                <div className="px-4 pb-4">
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--fg-2)' }}>{room.description}</p>
                </div>
            )}
        </div>
    );
};
