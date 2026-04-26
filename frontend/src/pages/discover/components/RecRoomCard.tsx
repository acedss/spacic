import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { RecRoom } from '@/lib/recsService';

export const RecRoomCard = ({ room, rank }: { room: RecRoom; rank: number }) => {
    const cover = room.coverImageUrl || room.creatorId?.imageUrl || null;
    const isLive = room.status === 'live';

    return (
        <Link
            to={`/rooms/${room._id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/6 hover:border-white/12 transition-all group"
        >
            <span className="mono text-[10px] text-(--fg-3) w-4 text-right shrink-0">{rank}</span>
            <div className="relative shrink-0">
                {cover ? (
                    <img src={cover} alt={room.title} className="size-10 rounded-lg object-cover" />
                ) : (
                    <div className="size-10 rounded-lg bg-white/5 grid place-items-center">
                        <Users className="size-4 text-(--fg-3)" />
                    </div>
                )}
                {isLive && <span className="absolute -top-1 -right-1 live-dot" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                    {room.title}
                </p>
                <p className="text-xs text-(--fg-3) truncate">
                    {room.creatorId?.fullName ?? 'Spacic'}
                    {room.tags?.length ? ` · ${room.tags.slice(0, 2).join(' · ')}` : ''}
                </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-(--fg-3)">
                <Users className="size-3" />
                <span className="mono text-[11px]">
                    {(room.stats?.totalListeners ?? 0).toLocaleString()}
                </span>
            </div>
        </Link>
    );
};
