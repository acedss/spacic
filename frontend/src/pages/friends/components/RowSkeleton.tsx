import { Skeleton } from '@/components/ui/skeleton';

interface Props {
    rows?: number;
    showAction?: boolean;
}

export const RowSkeleton = ({ rows = 3, showAction = true }: Props) => (
    <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 bg-white/5" />
                    <Skeleton className="h-3 w-24 bg-white/5" />
                </div>
                {showAction && <Skeleton className="h-8 w-24 rounded-lg bg-white/5" />}
            </div>
        ))}
    </div>
);
