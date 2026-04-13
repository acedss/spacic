import { cn } from '@/lib/utils'

export const CHART_COLORS = {
    revenue:   '#a78bfa',
    signups:   '#34d399',
    donations: '#f59e0b',
    FREE:      '#52525b',
    PREMIUM:   '#a78bfa',
    CREATOR:   '#fbbf24',
}

export const AXIS_STYLE  = { fontSize: 10, fill: '#52525b' }
export const GRID_STROKE = '#27272a'
export const TIP_STYLE   = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }

export const ChartCard = ({ title, children, className }: {
    title: string; children: React.ReactNode; className?: string;
}) => (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 p-4', className)}>
        <p className="text-xs font-medium text-zinc-400 mb-4">{title}</p>
        {children}
    </div>
)

export const EmptyChart = () => (
    <div className="h-40 flex items-center justify-center text-xs text-zinc-600">No data yet</div>
)
