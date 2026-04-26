import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Loader, Users, Clock, TrendingUp, CreditCard, Download,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAnalytics, type AnalyticsGranularity } from '../AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';
import {
    type Stats, formatCredits, fmtMinutesCompact, fmtDateShort, fmtDateLong,
    fmtDateTimeInput, sortByDateAsc,
} from '../admin-shared';

type OverviewTab = 'overview' | 'revenue' | 'users' | 'content' | 'rooms';

const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue',  label: 'Revenue'  },
    { id: 'users',    label: 'Users'    },
    { id: 'content',  label: 'Content'  },
    { id: 'rooms',    label: 'Rooms'    },
];

export const OverviewSection = () => {
    const [stats, setStats]     = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]         = useState<OverviewTab>('overview');
    const [roomSortKey, setRoomSortKey] = useState<'listeners' | 'coinsEarned' | 'minutesListened' | 'sessions' | 'avgListeners'>('listeners');
    const [roomSortDir, setRoomSortDir] = useState<'asc' | 'desc'>('desc');
    const {
        data: an, loading: anLoading, granularity, setGranularity,
        from, setFrom, to, setTo, applyRange, refresh,
    } = useAnalytics();

    useEffect(() => {
        axiosInstance.get('/admin/stats')
            .then(r => setStats(r.data.data))
            .catch(() => toast.error('Failed to load stats'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>;
    if (!stats)  return null;

    const dailyRevenue = sortByDateAsc(an?.dailyRevenue ?? []);
    const donationsByDay = sortByDateAsc(an?.donationsByDay ?? []);
    const dailySignups = sortByDateAsc(an?.dailySignups ?? []);
    const roomDaily = sortByDateAsc(an?.roomDailySessions ?? []);
    const donationsByDate = new Map(donationsByDay.map((d) => [d.date, d]));

    const totalRevenueCents    = dailyRevenue.reduce((s, d) => s + d.revenue, 0);
    const totalDonationsCents  = donationsByDay.reduce((s, d) => s + d.amount, 0);
    const totalTxns            = dailyRevenue.reduce((s, d) => s + d.txns, 0);
    const totalSignups         = dailySignups.reduce((s, d) => s + d.count, 0);
    const conversionRate       = stats.totalUsers > 0
        ? (((stats.users.PREMIUM + stats.users.CREATOR) / stats.totalUsers) * 100).toFixed(1)
        : '0.0';
    const avgTxn               = totalTxns > 0 ? (totalRevenueCents / totalTxns / 100).toFixed(2) : '0.00';

    const rangeDays = an?.days ?? 0;

    const kpis = [
        { label: 'Total Revenue',    value: `$${(totalRevenueCents / 100).toFixed(0)}`,   sub: `credit top-ups · ${rangeDays}d`, color: 'text-violet-400',  icon: TrendingUp },
        { label: 'Platform Users',   value: stats.totalUsers.toLocaleString(),             sub: `${stats.users.FREE} free tier`, color: 'text-emerald-400', icon: Users },
        { label: 'Premium Conv.',    value: `${conversionRate}%`,                          sub: 'paid subscribers',        color: 'text-sky-400',     icon: TrendingUp },
        { label: 'Creator Earnings', value: `$${(totalDonationsCents / 100).toFixed(0)}`, sub: `donations · ${rangeDays}d`, color: 'text-amber-400',   icon: TrendingUp },
        { label: 'Avg Transaction',  value: `$${avgTxn}`,                                  sub: `${totalTxns} top-ups`,    color: 'text-pink-400',    icon: CreditCard },
        { label: 'New Signups',      value: totalSignups.toLocaleString(),                 sub: `last ${rangeDays} days`,  color: 'text-teal-400',    icon: TrendingUp },
    ];

    const combinedTrend = dailyRevenue.map(d => {
        const don = donationsByDate.get(d.date);
        return {
            date: d.date,
            'Top-ups':   +(d.revenue / 100).toFixed(2),
            'Donations': +((don?.amount ?? 0) / 100).toFixed(2),
        };
    });

    const tierPie = (an?.tierDist ?? []).map(t => ({
        name: t.tier, value: t.count,
        color: (CHART_COLORS as any)[t.tier] ?? '#52525b',
    }));

    const roomSummary = an?.roomSummary ?? {
        totalRooms: 0, liveRooms: 0, sessions: 0, listeners: 0, minutesListened: 0, coinsEarned: 0,
    };

    const topRoomsSorted = [...(an?.topRooms ?? [])].sort((a, b) => {
        const dir = roomSortDir === 'asc' ? 1 : -1;
        return (a[roomSortKey] - b[roomSortKey]) * dir;
    });

    const exportAnalytics = () => {
        const payload = {
            generatedAt: new Date().toISOString(),
            rangeDays, granularity, from, to, tab, stats, analytics: an,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin-analytics-${tab}-${granularity}-${rangeDays}d.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Overview of your music platform's performance and creator ecosystem
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={granularity}
                        onChange={e => setGranularity(e.target.value as AnalyticsGranularity)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-zinc-300"
                    >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                    <Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-[180px] bg-white/5 border-white/10 text-xs text-zinc-300" />
                    <Input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-[180px] bg-white/5 border-white/10 text-xs text-zinc-300" />
                    <Button size="sm" variant="outline" className="border-white/10 text-zinc-400 hover:text-white" onClick={applyRange}>Apply</Button>
                    <Button size="sm" variant="outline" className="border-white/10 text-zinc-400 hover:text-white" onClick={refresh}>Refresh</Button>
                    <Button size="sm" variant="outline" className="border-white/10 text-zinc-400 hover:text-white gap-1.5 shrink-0" onClick={exportAnalytics}>
                        <Download className="size-3.5" /> Export
                    </Button>
                </div>
            </div>
            <p className="text-xs text-zinc-600 -mt-5">
                Showing {granularity} data from {fmtDateTimeInput(from)} to {fmtDateTimeInput(to)}
            </p>

            <div className="flex gap-0 border-b border-white/10">
                {OVERVIEW_TABS.map(t => (
                    <button
                        key={t.id} onClick={() => setTab(t.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            tab === t.id ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border border-white/10 rounded-xl overflow-hidden divide-x divide-y md:divide-y-0 divide-white/10">
                {kpis.map(k => (
                    <div key={k.label} className="flex flex-col items-center justify-center gap-1.5 px-3 py-5">
                        <span className="text-[11px] text-zinc-500 font-medium text-center leading-tight">{k.label}</span>
                        <span className={cn('text-xl font-bold tabular-nums', k.color)}>{k.value}</span>
                        <div className="flex items-center gap-1">
                            <Clock className="size-2.5 text-zinc-600" />
                            <span className="text-[10px] text-zinc-600 text-center">{k.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            {anLoading ? (
                <div className="flex items-center gap-2 text-zinc-400 py-8">
                    <Loader className="size-4 animate-spin" /> Loading charts...
                </div>
            ) : an && (
                <>
                    {tab === 'overview' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-300">Revenue &amp; Donation Trends</h3>
                                <span className="text-xs text-zinc-600 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">Past {rangeDays} days</span>
                            </div>
                            <ChartCard title="">
                                {combinedTrend.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={combinedTrend}>
                                            <defs>
                                                <linearGradient id="gTopup" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={CHART_COLORS.revenue}   stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.revenue}   stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gDon" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={CHART_COLORS.donations} stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.donations} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${v}`} />
                                            <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} formatter={(v) => `$${Number(v).toFixed(2)}`} />
                                            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                                            <Area type="monotone" dataKey="Top-ups"   stroke={CHART_COLORS.revenue}   fill="url(#gTopup)" strokeWidth={2} dot={false} />
                                            <Area type="monotone" dataKey="Donations" stroke={CHART_COLORS.donations} fill="url(#gDon)"   strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <div className="h-px w-full bg-white/5" />

                            {stats.recentTopups.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-zinc-300">Recent Top-ups</h3>
                                        <span className="text-xs text-zinc-600">{stats.recentTopups.length} transactions</span>
                                    </div>
                                    <div className="rounded-xl border border-white/10 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-white/10 hover:bg-transparent">
                                                    <TableHead className="text-zinc-500">User</TableHead>
                                                    <TableHead className="text-zinc-500">Amount</TableHead>
                                                    <TableHead className="text-zinc-500 hidden md:table-cell">Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {stats.recentTopups.map(t => (
                                                    <TableRow key={t._id} className="border-white/5 hover:bg-white/[0.03]">
                                                        <TableCell>
                                                            <div className="flex items-center gap-2.5">
                                                                <img src={t.userId?.imageUrl} className="size-7 rounded-full flex-shrink-0" />
                                                                <span className="text-sm text-white font-medium">{t.userId?.fullName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm font-semibold text-emerald-400">+{formatCredits(t.amount)}</span>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell">
                                                            <span className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'revenue' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ChartCard title="Daily top-up revenue">
                                    {dailyRevenue.length === 0 ? <EmptyChart /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={dailyRevenue.map(d => ({ ...d, revenue: +(d.revenue / 100).toFixed(2) }))} barCategoryGap="20%">
                                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                                <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                                <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${v}`} />
                                                <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} formatter={(v) => [`$${Number(v)}`, 'Revenue']} />
                                                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>

                                <ChartCard title="Creator donations per day">
                                    {donationsByDay.length === 0 ? <EmptyChart /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <AreaChart data={donationsByDay.map(d => ({ ...d, amount: +(d.amount / 100).toFixed(2) }))}>
                                                <defs>
                                                    <linearGradient id="gDon2" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%"  stopColor={CHART_COLORS.donations} stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor={CHART_COLORS.donations} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                                <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                                <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${v}`} />
                                                <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} formatter={(v) => [`$${Number(v)}`, 'Donations']} />
                                                <Area type="monotone" dataKey="amount" name="Donations" stroke={CHART_COLORS.donations} fill="url(#gDon2)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>
                            </div>

                            <ChartCard title="Revenue split — top-ups vs creator donations">
                                {(totalRevenueCents === 0 && totalDonationsCents === 0) ? <EmptyChart /> : (
                                    <div className="flex flex-col md:flex-row items-center gap-8 py-2">
                                        <ResponsiveContainer width={180} height={160}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Top-ups',   value: totalRevenueCents },
                                                        { name: 'Donations', value: totalDonationsCents },
                                                    ]}
                                                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value"
                                                >
                                                    {[CHART_COLORS.revenue, CHART_COLORS.donations].map((c, i) => <Cell key={i} fill={c} />)}
                                                </Pie>
                                                <Tooltip contentStyle={TIP_STYLE} formatter={(v) => `$${(Number(v) / 100).toFixed(2)}`} />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        <div className="flex-1 space-y-4 w-full">
                                            {[
                                                { label: 'Credit Top-ups',      val: totalRevenueCents,   barColor: 'bg-violet-500' },
                                                { label: 'Creator Donations',   val: totalDonationsCents, barColor: 'bg-amber-500'  },
                                            ].map(item => {
                                                const total = totalRevenueCents + totalDonationsCents;
                                                const pct   = total > 0 ? (item.val / total) * 100 : 0;
                                                return (
                                                    <div key={item.label} className="space-y-1.5">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-zinc-400">{item.label}</span>
                                                            <span className="text-zinc-200 font-semibold tabular-nums">
                                                                ${(item.val / 100).toFixed(0)}
                                                                <span className="text-zinc-500 font-normal ml-1">({pct.toFixed(1)}%)</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                            <div className={cn('h-full rounded-full transition-all', item.barColor)} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
                                                <div className="bg-white/5 rounded-lg px-3 py-2">
                                                    <p className="text-zinc-600">Avg transaction</p>
                                                    <p className="text-zinc-200 font-semibold">${avgTxn}</p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg px-3 py-2">
                                                    <p className="text-zinc-600">Total transactions</p>
                                                    <p className="text-zinc-200 font-semibold">{totalTxns}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ChartCard>
                        </div>
                    )}

                    {tab === 'users' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <ChartCard title={`New signups — last ${rangeDays} days`} className="md:col-span-2">
                                    {dailySignups.length === 0 ? <EmptyChart /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <AreaChart data={dailySignups}>
                                                <defs>
                                                    <linearGradient id="gSig" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%"  stopColor={CHART_COLORS.signups} stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor={CHART_COLORS.signups} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                                <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                                                <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} />
                                                <Area type="monotone" dataKey="count" name="Signups" stroke={CHART_COLORS.signups} fill="url(#gSig)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>

                                <ChartCard title="Tier distribution">
                                    {tierPie.length === 0 ? <EmptyChart /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie data={tierPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                                    {tierPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={TIP_STYLE} />
                                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>
                            </div>

                            <ChartCard title="Tier conversion funnel">
                                <div className="space-y-4 py-2">
                                    {[
                                        { tier: 'FREE',    count: stats.users.FREE,    barColor: 'bg-zinc-500'   },
                                        { tier: 'PREMIUM', count: stats.users.PREMIUM, barColor: 'bg-violet-500' },
                                        { tier: 'CREATOR', count: stats.users.CREATOR, barColor: 'bg-yellow-500' },
                                    ].map(row => {
                                        const pct = stats.totalUsers > 0 ? (row.count / stats.totalUsers) * 100 : 0;
                                        return (
                                            <div key={row.tier} className="flex items-center gap-3">
                                                <span className="text-xs text-zinc-500 w-16 font-mono">{row.tier}</span>
                                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full', row.barColor)} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs text-zinc-200 tabular-nums w-12 text-right font-semibold">{row.count.toLocaleString()}</span>
                                                <span className="text-xs text-zinc-600 tabular-nums w-12">{pct.toFixed(1)}%</span>
                                            </div>
                                        );
                                    })}
                                    <div className="pt-2 text-xs text-zinc-600 flex items-center gap-1.5">
                                        <TrendingUp className="size-3 text-violet-400" />
                                        <span>Paid conversion rate: <span className="text-violet-400 font-semibold">{conversionRate}%</span></span>
                                    </div>
                                </div>
                            </ChartCard>
                        </div>
                    )}

                    {tab === 'content' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Song Library',      value: stats.songCount.toLocaleString(),            color: 'text-violet-400' },
                                    { label: 'Credits Topped Up', value: formatCredits(stats.totalCreditsToppedup),    color: 'text-emerald-400' },
                                    { label: 'Unique Artists',    value: an.topArtists.length.toLocaleString(),        color: 'text-sky-400' },
                                    { label: 'Songs / Artist',    value: an.topArtists.length > 0 ? (stats.songCount / an.topArtists.length).toFixed(1) : '—', color: 'text-amber-400' },
                                ].map(c => (
                                    <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs text-zinc-500 mb-1.5">{c.label}</p>
                                        <p className={cn('text-2xl font-bold tabular-nums', c.color)}>{c.value}</p>
                                    </div>
                                ))}
                            </div>

                            <ChartCard title="Top artists by song count">
                                {an.topArtists.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={Math.max(120, an.topArtists.length * 32)}>
                                        <BarChart data={an.topArtists} layout="vertical" barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                            <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis type="category" dataKey="artist" tick={{ ...AXIS_STYLE, fontSize: 11 }} width={100} />
                                            <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                            <Bar dataKey="songs" name="Songs" fill={CHART_COLORS.revenue} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    )}

                    {tab === 'rooms' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Rooms', value: roomSummary.totalRooms.toLocaleString(), color: 'text-violet-400' },
                                    { label: 'Live Right Now', value: roomSummary.liveRooms.toLocaleString(), color: 'text-emerald-400' },
                                    { label: `Sessions (${rangeDays}d)`, value: roomSummary.sessions.toLocaleString(), color: 'text-sky-400' },
                                    { label: `Listeners (${rangeDays}d)`, value: roomSummary.listeners.toLocaleString(), color: 'text-amber-400' },
                                ].map(card => (
                                    <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs text-zinc-500 mb-1.5">{card.label}</p>
                                        <p className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</p>
                                    </div>
                                ))}
                            </div>

                            <ChartCard title={`Room session trend — last ${rangeDays} days`}>
                                {roomDaily.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={roomDaily}>
                                            <defs>
                                                <linearGradient id="gRoomSessions" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gRoomListeners" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis yAxisId="left" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                labelFormatter={value => fmtDateLong(String(value))}
                                                formatter={(value, name) => {
                                                    if (name === 'Minutes') return [fmtMinutesCompact(Number(value)), name];
                                                    if (name === 'Coins') return [formatCredits(Number(value)), name];
                                                    return [Number(value).toLocaleString(), name];
                                                }}
                                            />
                                            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                                            <Area yAxisId="left" type="monotone" dataKey="sessions" name="Sessions" stroke="#38bdf8" fill="url(#gRoomSessions)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="right" type="monotone" dataKey="listeners" name="Listeners" stroke="#a78bfa" fill="url(#gRoomListeners)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title={`Top rooms in the last ${rangeDays} days`}>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                                        Sort by
                                        <select
                                            value={roomSortKey}
                                            onChange={e => setRoomSortKey(e.target.value as typeof roomSortKey)}
                                            className="bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-zinc-300"
                                        >
                                            <option value="listeners">Listeners</option>
                                            <option value="coinsEarned">Coins earned</option>
                                            <option value="minutesListened">Minutes listened</option>
                                            <option value="sessions">Sessions</option>
                                            <option value="avgListeners">Avg listeners</option>
                                        </select>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-white/10 text-zinc-300 hover:text-white" onClick={() => setRoomSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                                        {roomSortDir === 'desc' ? 'Highest first' : 'Lowest first'}
                                    </Button>
                                </div>
                                {topRoomsSorted.length === 0 ? <EmptyChart /> : (
                                    <div className="rounded-lg border border-white/10 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-white/10 hover:bg-transparent">
                                                    <TableHead className="text-zinc-500">Room</TableHead>
                                                    <TableHead className="text-zinc-500 text-right">Sessions</TableHead>
                                                    <TableHead className="text-zinc-500 text-right">Listeners</TableHead>
                                                    <TableHead className="text-zinc-500 text-right">Avg/listeners</TableHead>
                                                    <TableHead className="text-zinc-500 text-right">Minutes</TableHead>
                                                    <TableHead className="text-zinc-500 text-right">Coins</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {topRoomsSorted.slice(0, 12).map(room => (
                                                    <TableRow key={room.roomId} className="border-white/5">
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn('inline-block size-2 rounded-full', room.status === 'live' ? 'bg-emerald-400' : 'bg-zinc-600')} />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm text-white truncate max-w-[240px]">{room.title}</p>
                                                                    <p className="text-[11px] text-zinc-500">{room.favoriteCount.toLocaleString()} favorites</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-zinc-300">{room.sessions.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-zinc-300">{room.listeners.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-zinc-300">{room.avgListeners.toFixed(1)}</TableCell>
                                                        <TableCell className="text-right text-zinc-300">{fmtMinutesCompact(room.minutesListened)}</TableCell>
                                                        <TableCell className="text-right text-emerald-400">{formatCredits(room.coinsEarned)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </ChartCard>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
