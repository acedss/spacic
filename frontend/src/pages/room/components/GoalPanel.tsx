import { useRoomStore } from '@/stores/useRoomStore';
import { cn } from '@/lib/utils';

export const GoalPanel = () => {
    const { room } = useRoomStore();
    const goalPct = room ? Math.min(100, Math.round(((room as any).streamGoalCurrent ?? 0) / Math.max(1, (room as any).streamGoal ?? 1) * 100)) : 0;

    const milestones = [
        { at: 100, label: 'Unreleased song preview', done: true },
        { at: 300, label: 'Shout-out from the host', done: true },
        { at: 500, label: 'Secret track reveal', done: false, here: true },
        { at: 750, label: 'Live Q&A extension', done: false },
        { at: 1000, label: 'Physical vinyl raffle', done: false },
    ];

    return (
        <div className="p-5 overflow-auto h-full hide-scrollbar">
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>Tonight's goal</div>
            <h3 className="serif text-[26px] leading-tight text-white italic">{room?.title ?? 'Stream Goal'}</h3>

            <div className="mt-5 p-4 rounded-xl ring-1 ring-white/10 bg-white/4">
                <div className="flex items-baseline justify-between">
                    <span className="mono text-[28px] text-white tabular-nums">
                        {(room as any)?.streamGoalCurrent ?? 0}
                        <span className="text-[14px]" style={{ color: 'var(--fg-3)' }}> / {(room as any)?.streamGoal ?? 0}</span>
                    </span>
                    <span className="mono text-[11px] text-[oklch(0.88_0.12_75)] tabular-nums">{goalPct}%</span>
                </div>
                <div className="mt-2 h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full line-scan"
                        style={{ width: `${goalPct}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                </div>
            </div>

            <div className="mt-6 mono text-[9px] uppercase tracking-widest mb-3" style={{ color: 'var(--fg-3)' }}>Milestones</div>
            {milestones.map(m => (
                <div key={m.at} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <span className={cn(
                        'w-6 h-6 rounded-full grid place-items-center text-[10px] mono ring-1',
                        m.done ? 'bg-[oklch(0.74_0.14_160)] ring-[oklch(0.74_0.14_160)] text-[var(--ink-0)]'
                            : m.here ? 'bg-[oklch(0.82_0.15_75_/_0.2)] ring-[oklch(0.82_0.15_75)] text-[oklch(0.88_0.12_75)]'
                                : 'bg-white/4 ring-white/12 text-[var(--fg-3)]',
                    )}>
                        {m.done ? '✓' : m.at}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[12px] ${m.done ? 'text-white/70 line-through' : m.here ? 'text-white' : 'text-[var(--fg-2)]'}`}>
                            {m.label}
                        </p>
                        {m.here && <p className="text-[10px] text-[oklch(0.88_0.12_75)] mono uppercase tracking-wider mt-0.5">173 coins to unlock</p>}
                    </div>
                    <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>{m.at}</span>
                </div>
            ))}
        </div>
    );
};
