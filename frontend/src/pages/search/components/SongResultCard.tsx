import { Music } from 'lucide-react';
import type { Song } from '@/types/types';

export const SongResultCard = ({ song }: { song: Song }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 transition-all group">
        <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{song.title}</p>
            <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
        </div>
        <Music className="size-4 text-zinc-700 flex-shrink-0" />
    </div>
);
