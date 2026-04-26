import { Flame } from 'lucide-react';
import type { TrendingSong } from '@/lib/recsService';

export const TrendingSongCard = ({ song, rank }: { song: TrendingSong; rank: number }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/6 hover:border-white/12 transition-all group">
        <span className="mono text-[10px] text-(--fg-3) w-4 text-right shrink-0">{rank}</span>
        <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                {song.title}
            </p>
            <p className="text-xs text-(--fg-3) truncate">{song.artist}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
            <Flame className="size-3 text-amber-500" />
            <span className="mono text-[11px] text-(--fg-2)">
                {(song.todayStreams || song.streamCount).toLocaleString()}
            </span>
        </div>
    </div>
);
