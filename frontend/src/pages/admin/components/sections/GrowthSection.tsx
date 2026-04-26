import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader } from 'lucide-react';
import {
    LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';

interface GrowthData {
    granularity: 'monthly' | 'quarterly' | 'yearly';
    summary: {
        totalUsers: number; paidUsers: number; activeSubs: number;
        conversionRate: number; churnRate: number;
        mrrCents: number; arrCents: number;
        thisWindowSignups: number; prevWindowSignups: number; signupGrowth: number | null;
        thisWindowRevenueCents: number; prevWindowRevenueCents: number; revenueGrowth: number | null;
    };
    tierComposition: Record<string, number>;
    subStatusCounts: Record<string, number>;
    series: { period: string; signups: number; paidSignups: number }[];
    cohorts: { cohort: string; signups: number; stillPaid: number; retentionPercent: number }[];
}

const TIER_PIE_COLORS: Record<string, string> = {
    FREE:    '#52525b',
    PREMIUM: '#a855f7',
    CREATOR: '#f59e0b',
};

export const GrowthSection = () => {
    const [granularity, setGranularity] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
    const [data, setData] = useState<GrowthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let canceled = false;
        setLoading(true);
        axiosInstance.get('/admin/analytics/growth', { params: { granularity } })
            .then(r => { if (!canceled) setData(r.data.data); })
            .catch(() => { if (!canceled) toast.error('Failed to load growth analytics'); })
            .finally(() => { if (!canceled) setLoading(false); });
        return () => { canceled = true; };
    }, [granularity]);

    const fmtPeriod = (iso: string) => {
        const d = new Date(iso);
        if (granularity === 'yearly') return d.getFullYear().toString();
        if (granularity === 'quarterly') return `Q${Math.floor(d.getMonth()/3)+1} '${String(d.getFullYear()).slice(2)}`;
        return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    };
    const fmtCohort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    const fmtDelta = (pct: number | null) => pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`;
    const deltaColor = (pct: number | null) => pct === null ? 'text-zinc-500' : pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-zinc-400';

    if (loading || !data) {
        return (
            <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white">Growth Analytics</h2>
                <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading…</div>
            </div>
        );
    }

    const { summary, tierComposition, series, cohorts } = data;
    const tierData = Object.entries(tierComposition).map(([tier, count]) => ({ tier, count }));
    const totalCohortSignups = cohorts.reduce((s, c) => s + c.signups, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-lg font-semibold text-white">Growth Analytics</h2>
                    <p className="text-sm text-zinc-500 mt-1">Subscription growth · MRR · churn · cohort retention</p>
                </div>
                <div className="flex gap-1 rounded-lg bg-white/5 p-1 border border-white/10">
                    {(['monthly', 'quarterly', 'yearly'] as const).map(g => (
                        <button key={g} onClick={() => setGranularity(g)}
                            className={cn('px-3 py-1 text-xs rounded-md capitalize transition-colors',
                                granularity === g ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white')}>
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">MRR</p>
                    <p className="text-2xl font-semibold text-white mt-1 tabular-nums">${(summary.mrrCents/100).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">ARR ${(summary.arrCents/100).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Paid Subscribers</p>
                    <p className="text-2xl font-semibold text-white mt-1 tabular-nums">{summary.paidUsers.toLocaleString()}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">{summary.conversionRate}% of {summary.totalUsers.toLocaleString()} users</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">New Signups · this {granularity.replace('ly','')}</p>
                    <p className="text-2xl font-semibold text-white mt-1 tabular-nums">{summary.thisWindowSignups.toLocaleString()}</p>
                    <p className={cn('text-[11px] mt-1', deltaColor(summary.signupGrowth))}>
                        {fmtDelta(summary.signupGrowth)} vs prior period
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Churn Rate</p>
                    <p className="text-2xl font-semibold text-white mt-1 tabular-nums">{summary.churnRate}%</p>
                    <p className="text-[11px] text-zinc-500 mt-1">{summary.activeSubs} active subs</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white mb-1">Revenue this period</p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-3xl font-semibold text-white tabular-nums">${(summary.thisWindowRevenueCents/100).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                        <p className={cn('text-sm font-medium', deltaColor(summary.revenueGrowth))}>{fmtDelta(summary.revenueGrowth)}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                        Prior period: ${(summary.prevWindowRevenueCents/100).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white mb-1">Signup acquisition</p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-3xl font-semibold text-white tabular-nums">{summary.thisWindowSignups.toLocaleString()}</p>
                        <p className={cn('text-sm font-medium', deltaColor(summary.signupGrowth))}>{fmtDelta(summary.signupGrowth)}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Prior period: {summary.prevWindowSignups.toLocaleString()}</p>
                </div>
            </div>

            <ChartCard title={`Signups per ${granularity.replace('ly','')}`}>
                {series.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="period" tick={AXIS_STYLE} tickFormatter={fmtPeriod} />
                            <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                            <Tooltip contentStyle={TIP_STYLE} labelFormatter={v => fmtPeriod(String(v))} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="signups" name="Total signups" stroke={CHART_COLORS.revenue} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="paidSignups" name="Paid signups" stroke={CHART_COLORS.donations} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="Tier composition (current)">
                    {tierData.length === 0 ? <EmptyChart /> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={70} label>
                                    {tierData.map(t => (
                                        <Cell key={t.tier} fill={TIER_PIE_COLORS[t.tier] ?? '#52525b'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TIP_STYLE} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white mb-3">Cohort retention (last 6 months)</p>
                    <p className="text-[11px] text-zinc-500 mb-3">% of each month's signups currently on a paid tier</p>
                    {cohorts.length === 0 ? (
                        <p className="text-sm text-zinc-600 text-center py-6">No cohort data.</p>
                    ) : (
                        <div className="space-y-2">
                            {cohorts.map(c => (
                                <div key={c.cohort} className="flex items-center gap-3 text-xs">
                                    <span className="w-16 text-zinc-400 tabular-nums">{fmtCohort(c.cohort)}</span>
                                    <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden relative">
                                        <div className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/60" style={{ width: `${Math.min(100, c.retentionPercent)}%` }} />
                                        <span className="absolute inset-0 flex items-center justify-end pr-2 text-white text-[10px] font-medium tabular-nums">
                                            {c.retentionPercent}% ({c.stillPaid}/{c.signups})
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div className="border-t border-white/5 pt-2 mt-3 flex justify-between text-[11px] text-zinc-500">
                                <span>Total cohort signups</span>
                                <span className="tabular-nums">{totalCohortSignups.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
