import { cn } from '@/lib/utils';

export const StatBadge = ({ icon: Icon, value, label, color }: {
    icon: React.ElementType; value: string | number; label: string; color: string;
}) => (
    <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-w-[100px]">
        <Icon className={cn('size-4 flex-shrink-0', color)} />
        <div>
            <p className="text-sm font-bold text-white tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
        </div>
    </div>
);
