import { Skeleton } from '@/components/ui/skeleton';

export const PlanGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 p-6 space-y-4">
                <Skeleton className="size-10 rounded-xl bg-white/5" />
                <Skeleton className="h-6 w-24 bg-white/5" />
                <Skeleton className="h-8 w-20 bg-white/5" />
                <div className="space-y-2 my-4">
                    {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-4 w-full bg-white/5" />)}
                </div>
                <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
            </div>
        ))}
    </div>
);
