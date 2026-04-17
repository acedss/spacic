import { cn } from '@/lib/utils'

export const StatCard = ({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: string | number; color: string;
}) => (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', color)}>
            <Icon className="size-4 text-white" />
        </div>
        <div>
            <p className="text-lg font-bold text-white leading-none">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
    </div>
)
