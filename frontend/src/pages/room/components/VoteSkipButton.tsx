import { SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoomStore } from '@/stores/useRoomStore';

interface Props {
    onVoteSkip: () => void;
}

export const VoteSkipButton = ({ onVoteSkip }: Props) => {
    const { skipVotes, isCreator } = useRoomStore();
    if (isCreator) return null;

    const pct = skipVotes.needed > 0
        ? Math.round((skipVotes.count / skipVotes.needed) * 100)
        : 0;

    return (
        <Button
            onClick={onVoteSkip}
            variant="ghost"
            size="sm"
            className="relative bg-zinc-800/60 hover:bg-zinc-700 border border-white/10 rounded-lg text-xs text-zinc-300 gap-1.5 overflow-hidden"
        >
            <div
                className="absolute inset-0 bg-orange-500/20 transition-all duration-300"
                style={{ width: `${Math.min(100, pct)}%` }}
            />
            <SkipForward className="size-3.5 relative z-10" />
            <span className="relative z-10">
                Skip {skipVotes.count}/{skipVotes.needed}
            </span>
        </Button>
    );
};
