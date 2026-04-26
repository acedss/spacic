import { Loader2 } from 'lucide-react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
    Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { CreatorRoomAnalytics, RoomInfo, RoomSession } from '@/types/types';
import { StatsStrip } from './StatsStrip';
import { ChartShell } from './ChartShell';
import { Card, SectionHead } from './studio-atoms';
import {
    CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP,
    fmtDateLong, fmtDateShort, sortByDateAsc, toHours,
    type AnalyticsGranularity,
} from './studio-shared';

interface Props {
    room: RoomInfo;
    analytics: CreatorRoomAnalytics | null;
    analyticsLoading: boolean;
    granularity: AnalyticsGranularity;
    setGranularity: (g: AnalyticsGranularity) => void;
    from: string;
    to: string;
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
    onApply: () => void;
    onRefresh: () => void;
}

export const OverviewTab = ({
    room, analytics, analyticsLoading, granularity, setGranularity,
    from, to, setFrom, setTo, onApply, onRefresh,
}: Props) => {
    const sessionTrend = sortByDateAsc(analytics?.sessionTrend ?? []);
    const donationTrend = sortByDateAsc(analytics?.donationTrend ?? []);
    const topSongs = analytics?.topSongs ?? [];
    const topSessions = analytics?.topSessions ?? [];
    const summary = analytics?.summary ?? { sessions: 0, listeners: 0, minutesListened: 0, coinsEarned: 0, peakListeners: 0, avgListenersPerSession: 0 };

    return (
        <div className="space-y-6">
            <StatsStrip room={room} />

            <Card className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <SectionHead label="Room Analytics" sub="Track performance by time range and granularity" />
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={granularity} onChange={e => setGranularity(e.target.value as AnalyticsGranularity)}
                            className="h-8 rounded-xl ring-1 ring-white/10 px-2.5 mono text-[11px] outline-none"
                            style={{ background: 'var(--ink-1)', color: 'var(--fg-2)' }}>
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
                            className="h-8 w-44 mono text-[11px]" style={{ background: 'var(--ink-1)' }} />
                        <Input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
                            className="h-8 w-44 mono text-[11px]" style={{ background: 'var(--ink-1)' }} />
                        <button onClick={onApply} className="h-8 px-3 rounded-xl ring-1 ring-white/10 mono text-[11px] press hover:bg-white/5"
                            style={{ color: 'var(--fg-2)' }}>Apply</button>
                        <button onClick={onRefresh} className="h-8 px-3 rounded-xl ring-1 ring-white/10 mono text-[11px] press hover:bg-white/5"
                            style={{ color: 'var(--fg-2)' }}>Refresh</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 rounded-xl overflow-hidden ring-1 ring-white/8 divide-x divide-y lg:divide-y-0 divide-white/8">
                    {[
                        { label: 'Sessions', val: summary.sessions, color: 'text-white' },
                        { label: 'Listeners', val: summary.listeners, color: 'text-[oklch(0.8_0.15_295)]' },
                        { label: 'Avg/session', val: summary.avgListenersPerSession, color: 'text-[oklch(0.75_0.14_160)]' },
                        { label: 'Listen time', val: toHours(summary.minutesListened), color: 'text-[oklch(0.75_0.14_230)]', raw: true },
                        { label: 'Coins earned', val: summary.coinsEarned, color: 'text-[oklch(0.88_0.12_75)]' },
                        { label: 'Peak listeners', val: summary.peakListeners, color: 'text-[oklch(0.8_0.15_330)]' },
                    ].map(({ label, val, color, raw }) => (
                        <div key={label} className="px-4 py-3" style={{ background: 'var(--ink-1)' }}>
                            <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
                            <p className={cn('mono text-[20px] font-semibold leading-none tabular-nums', color)}>
                                {raw ? val : typeof val === 'number' ? val.toLocaleString() : val}
                            </p>
                        </div>
                    ))}
                </div>

                {analyticsLoading ? (
                    <div className="flex items-center gap-2 py-8" style={{ color: 'var(--fg-3)' }}>
                        <Loader2 className="size-4 animate-spin" />
                        <span className="mono text-[11px]">Loading analytics…</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <ChartShell title="Session trend">
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={sessionTrend}>
                                    <defs>
                                        <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="gListeners" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis yAxisId="s" tick={CHART_AXIS} allowDecimals={false} />
                                    <YAxis yAxisId="l" orientation="right" tick={CHART_AXIS} allowDecimals={false} />
                                    <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={v => fmtDateLong(String(v))} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Area yAxisId="s" type="monotone" dataKey="sessions" name="Sessions" stroke="#a78bfa" fill="url(#gSessions)" strokeWidth={2} dot={false} />
                                    <Area yAxisId="l" type="monotone" dataKey="listeners" name="Listeners" stroke="#34d399" fill="url(#gListeners)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartShell>
                        <ChartShell title="Donation trend">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={donationTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                                    <XAxis dataKey="date" tick={CHART_AXIS} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis tick={CHART_AXIS} />
                                    <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={v => fmtDateLong(String(v))} />
                                    <Bar dataKey="amount" name="Donations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartShell>
                        <ChartShell title="Top songs">
                            {topSongs.length === 0
                                ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No data yet</div>
                                : (
                                    <ResponsiveContainer width="100%" height={Math.max(180, Math.min(10, topSongs.length) * 30)}>
                                        <BarChart data={topSongs.slice(0, 10)} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                                            <XAxis type="number" tick={CHART_AXIS} allowDecimals={false} />
                                            <YAxis type="category" dataKey="title" width={130} tick={{ ...CHART_AXIS, fontSize: 11 }} tickFormatter={v => String(v).length > 20 ? `${String(v).slice(0, 20)}…` : String(v)} />
                                            <Tooltip contentStyle={CHART_TOOLTIP} />
                                            <Bar dataKey="streams" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                        </ChartShell>
                        <ChartShell title="Stream share">
                            {topSongs.length === 0
                                ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No data yet</div>
                                : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={topSongs.slice(0, 8)} dataKey="streams" nameKey="title" outerRadius={78} innerRadius={42} paddingAngle={2}>
                                                {topSongs.slice(0, 8).map((e, idx) => <Cell key={e.songId} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={CHART_TOOLTIP} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                        </ChartShell>
                        <ChartShell title="Top sessions">
                            {topSessions.length === 0
                                ? <div className="h-48 flex items-center justify-center mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No sessions yet</div>
                                : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {topSessions.map((s, i) => (
                                            <div key={i} className="rounded-xl ring-1 ring-white/8 px-3 py-2.5" style={{ background: 'var(--ink-1)' }}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{fmtDateLong(s.startedAt)}</p>
                                                    <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>{s.endedAt ? fmtDateLong(s.endedAt) : 'Live'}</p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                                                    <div><p className="mono text-[16px] font-semibold text-white">{s.listenerCount}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>listeners</p></div>
                                                    <div><p className="mono text-[16px] font-semibold text-[oklch(0.75_0.14_160)]">{toHours(s.minutesListened)}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>listened</p></div>
                                                    <div><p className="mono text-[16px] font-semibold text-[oklch(0.88_0.12_75)]">{s.coinsEarned.toLocaleString()}</p><p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>coins</p></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </ChartShell>
                    </div>
                )}
            </Card>

            {room.sessions && room.sessions.length > 0 && (
                <div className="space-y-3">
                    <SectionHead label="Recent Sessions" />
                    <div className="space-y-2">
                        {[...room.sessions].reverse().slice(0, 5).map((sess: RoomSession, i: number) => (
                            <div key={i} className="rounded-xl ring-1 ring-white/8 px-5 py-3 flex items-center justify-between gap-4" style={{ background: 'var(--ink-2)' }}>
                                <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
                                    {sess.endedAt ? new Date(sess.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                </p>
                                <div className="flex items-center gap-6">
                                    <span className="mono text-[13px] text-white">{sess.listenerCount} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>listeners</span></span>
                                    <span className="mono text-[13px] text-white">{toHours(sess.minutesListened ?? 0)} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>listened</span></span>
                                    <span className="mono text-[13px] text-[oklch(0.88_0.12_75)]">{sess.coinsEarned?.toLocaleString()} <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>coins</span></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
