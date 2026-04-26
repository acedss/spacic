export const SkeletonRow = () => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/6 animate-pulse">
        <div className="w-4 h-3 bg-white/8 rounded" />
        <div className="size-10 rounded-lg bg-white/8 shrink-0" />
        <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/8 rounded w-2/3" />
            <div className="h-2.5 bg-white/5 rounded w-1/3" />
        </div>
    </div>
);
