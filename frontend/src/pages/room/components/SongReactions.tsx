import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';

interface Props {
    onReact: (reaction: 'like' | 'dislike') => void;
}

export const SongReactions = ({ onReact }: Props) => {
    const { reactions } = useRoomStore();

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onReact('like')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/60 hover:bg-emerald-500/20 border border-white/10 text-xs text-zinc-300 hover:text-emerald-400 transition-colors"
            >
                <ThumbsUp className="size-3" />
                <span>{reactions.likes}</span>
            </button>
            <button
                onClick={() => onReact('dislike')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/60 hover:bg-red-500/20 border border-white/10 text-xs text-zinc-300 hover:text-red-400 transition-colors"
            >
                <ThumbsDown className="size-3" />
                <span>{reactions.dislikes}</span>
            </button>
        </div>
    );
};
