import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { axiosInstance } from '@/lib/axios';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    LayoutDashboard, CreditCard, Users, Music2, Package,
    Loader, Pencil, Check, X, Trash2, Upload, ChevronLeft, ChevronRight, Plus, Star,
    ExternalLink, ShieldCheck, Link2, Download, Clock, TrendingUp,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AnalyticsCtx, useAnalytics, type AnalyticsGranularity, type AnalyticsData } from './components/AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from './components/ChartCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
    _id: string; slug: string; name: string; tier: string;
    priceMonthlyUsd: number; priceYearlyUsd: number | null;
    stripePriceIdMonthly: string | null; stripePriceIdYearly: string | null;
    stripeProductId: string | null; features: string[]; isActive: boolean;
}

interface AdminUser {
    clerkId: string; fullName: string; username: string | null;
    imageUrl: string; userTier: string; role: string;
    subscriptionStatus: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    currentPeriodEnd: string | null;
    balance: number; createdAt: string;
}

interface Song {
    _id: string; title: string; artist: string;
    imageUrl: string; s3Key: string; duration: number;
}

interface SongAnalytics {
    playsPerPeriod: { date: string; plays: number; streams: number; skips: number }[];
    playsPerDay?: { date: string; plays: number; streams: number; skips: number }[];
    topSongs: { songId: string; title: string; artist: string; streams: number; plays: number; skips: number; listeners: number; skipRate: number }[];
    skipRates: { title: string; artist: string; plays: number; skipRate: number }[];
    geoBreakdown: { country: string; streams: number }[];
    summary: { plays: number; streams: number; skippedPlays: number; activeSongs: number };
    granularity: AnalyticsGranularity;
    from: string;
    to: string;
    days: number;
}

interface TopupPkg {
    _id: string; packageId: string; name: string;
    priceUsd: number; credits: number; bonusPercent: number;
    isActive: boolean; isFeatured: boolean; sortOrder: number;
}

interface Stats {
    users: { FREE: number; PREMIUM: number; CREATOR: number };
    totalUsers: number; activeSubscribers: number;
    songCount: number; totalCreditsToppedup: number;
    recentTopups: { _id: string; amount: number; createdAt: string; userId: { fullName: string; imageUrl: string } }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
    FREE:    'bg-zinc-700 text-zinc-300',
    PREMIUM: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    CREATOR: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
};

const formatCredits = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDuration   = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtMinutesCompact = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`);
const toDate = (value: string) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};
const fmtDateShort = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : value;
};
const fmtDateLong = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : value;
};
const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => {
        const aT = toDate(a.date)?.getTime() ?? 0;
        const bT = toDate(b.date)?.getTime() ?? 0;
        return aT - bT;
    });
const toDateTimeInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const fmtDateTimeInput = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : value;
};
const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const getAxiosErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message ?? fallback;
    }
    return fallback;
};

// ── Overview section ──────────────────────────────────────────────────────────

type OverviewTab = 'overview' | 'revenue' | 'users' | 'content' | 'rooms';

const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue',  label: 'Revenue'  },
    { id: 'users',    label: 'Users'    },
    { id: 'content',  label: 'Content'  },
    { id: 'rooms',    label: 'Rooms'    },
];

const OverviewSection = () => {
    const [stats, setStats]     = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]         = useState<OverviewTab>('overview');
    const [roomSortKey, setRoomSortKey] = useState<'listeners' | 'coinsEarned' | 'minutesListened' | 'sessions' | 'avgListeners'>('listeners');
    const [roomSortDir, setRoomSortDir] = useState<'asc' | 'desc'>('desc');
    const {
        data: an,
        loading: anLoading,
        granularity,
        setGranularity,
        from,
        setFrom,
        to,
        setTo,
        applyRange,
        refresh,
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

    // ── Derived KPIs ────────────────────────────────────────────────────────────
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

    // ── Chart data ───────────────────────────────────────────────────────────────
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
        totalRooms: 0,
        liveRooms: 0,
        sessions: 0,
        listeners: 0,
        minutesListened: 0,
        coinsEarned: 0,
    };

    const topRoomsSorted = [...(an?.topRooms ?? [])].sort((a, b) => {
        const dir = roomSortDir === 'asc' ? 1 : -1;
        return (a[roomSortKey] - b[roomSortKey]) * dir;
    });

    const exportAnalytics = () => {
        const payload = {
            generatedAt: new Date().toISOString(),
            rangeDays,
            granularity,
            from,
            to,
            tab,
            stats,
            analytics: an,
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

            {/* ── Page header ─────────────────────────────────────────────────── */}
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
                    <Input
                        type="datetime-local"
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        className="h-9 w-[180px] bg-white/5 border-white/10 text-xs text-zinc-300"
                    />
                    <Input
                        type="datetime-local"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        className="h-9 w-[180px] bg-white/5 border-white/10 text-xs text-zinc-300"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-zinc-400 hover:text-white"
                        onClick={applyRange}
                    >
                        Apply
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-zinc-400 hover:text-white"
                        onClick={refresh}
                    >
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-zinc-400 hover:text-white gap-1.5 shrink-0"
                        onClick={exportAnalytics}
                    >
                        <Download className="size-3.5" /> Export
                    </Button>
                </div>
            </div>
            <p className="text-xs text-zinc-600 -mt-5">
                Showing {granularity} data from {fmtDateTimeInput(from)} to {fmtDateTimeInput(to)}
            </p>

            {/* ── Tabs ────────────────────────────────────────────────────────── */}
            <div className="flex gap-0 border-b border-white/10">
                {OVERVIEW_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            tab === t.id
                                ? 'border-violet-500 text-white'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── KPI strip ───────────────────────────────────────────────────── */}
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

            {/* ── Chart area ──────────────────────────────────────────────────── */}
            {anLoading ? (
                <div className="flex items-center gap-2 text-zinc-400 py-8">
                    <Loader className="size-4 animate-spin" /> Loading charts...
                </div>
            ) : an && (
                <>
                    {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
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
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                labelFormatter={value => fmtDateLong(String(value))}
                                                formatter={(v) => `$${Number(v).toFixed(2)}`}
                                            />
                                            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                                            <Area type="monotone" dataKey="Top-ups"   stroke={CHART_COLORS.revenue}   fill="url(#gTopup)" strokeWidth={2} dot={false} />
                                            <Area type="monotone" dataKey="Donations" stroke={CHART_COLORS.donations} fill="url(#gDon)"   strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <div className="h-px w-full bg-white/5" />

                            {/* Recent top-ups table */}
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

                    {/* ── REVENUE TAB ───────────────────────────────────────────── */}
                    {tab === 'revenue' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ChartCard title="Daily top-up revenue">
                                    {dailyRevenue.length === 0 ? <EmptyChart /> : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart
                                                data={dailyRevenue.map(d => ({ ...d, revenue: +(d.revenue / 100).toFixed(2) }))}
                                                barCategoryGap="20%"
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                                <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                                <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${v}`} />
                                                <Tooltip
                                                    contentStyle={TIP_STYLE}
                                                    labelFormatter={value => fmtDateLong(String(value))}
                                                    formatter={(v) => [`$${Number(v)}`, 'Revenue']}
                                                />
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
                                                <Tooltip
                                                    contentStyle={TIP_STYLE}
                                                    labelFormatter={value => fmtDateLong(String(value))}
                                                    formatter={(v) => [`$${Number(v)}`, 'Donations']}
                                                />
                                                <Area type="monotone" dataKey="amount" name="Donations" stroke={CHART_COLORS.donations} fill="url(#gDon2)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartCard>
                            </div>

                            {/* Revenue split breakdown */}
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

                    {/* ── USERS TAB ─────────────────────────────────────────────── */}
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

                            {/* Conversion funnel */}
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

                    {/* ── CONTENT TAB ───────────────────────────────────────────── */}
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

                    {/* ── ROOMS TAB ─────────────────────────────────────────────── */}
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
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-white/10 text-zinc-300 hover:text-white"
                                        onClick={() => setRoomSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                                    >
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
                                                                <span className={cn(
                                                                    'inline-block size-2 rounded-full',
                                                                    room.status === 'live' ? 'bg-emerald-400' : 'bg-zinc-600',
                                                                )} />
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

// ── Plans section ─────────────────────────────────────────────────────────────

const PlanRow = ({ plan, onSaved }: { plan: Plan; onSaved: (p: Plan) => void }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [draft, setDraft]     = useState({
        stripePriceIdMonthly: plan.stripePriceIdMonthly ?? '',
        stripePriceIdYearly:  plan.stripePriceIdYearly  ?? '',
        stripeProductId:      plan.stripeProductId      ?? '',
        isActive:             plan.isActive,
        features:             plan.features.join('\n'),
    });

    const save = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.patch(`/admin/plans/${plan.slug}`, {
                stripePriceIdMonthly: draft.stripePriceIdMonthly,
                stripePriceIdYearly:  draft.stripePriceIdYearly,
                stripeProductId:      draft.stripeProductId,
                isActive:             draft.isActive,
                features:             draft.features.split('\n').map(f => f.trim()).filter(Boolean),
            });
            onSaved(data.data);
            setEditing(false);
            toast.success(`${plan.name} plan updated`);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{plan.name}</span>
                    <Badge className={cn('text-[10px]', TIER_COLORS[plan.tier])}>{plan.tier}</Badge>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', plan.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500')}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div className="flex gap-2">
                    {editing ? (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-zinc-400">
                                <X className="size-3.5" />
                            </Button>
                            <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
                                {saving ? <Loader className="size-3 animate-spin" /> : <Check className="size-3.5" />}
                                Save
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="text-zinc-400 hover:text-white gap-1.5">
                            <Pencil className="size-3.5" /> Edit
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Monthly Price ID</p>
                    {editing ? (
                        <Input
                            value={draft.stripePriceIdMonthly}
                            onChange={e => setDraft(d => ({ ...d, stripePriceIdMonthly: e.target.value }))}
                            placeholder="price_..."
                            className="bg-white/5 border-white/10 text-white text-xs h-8"
                        />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripePriceIdMonthly ?? '— not set'}</code>
                    )}
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Yearly Price ID</p>
                    {editing ? (
                        <Input
                            value={draft.stripePriceIdYearly}
                            onChange={e => setDraft(d => ({ ...d, stripePriceIdYearly: e.target.value }))}
                            placeholder="price_... (optional)"
                            className="bg-white/5 border-white/10 text-white text-xs h-8"
                        />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripePriceIdYearly ?? '— not set'}</code>
                    )}
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Stripe Product ID</p>
                    {editing ? (
                        <Input
                            value={draft.stripeProductId}
                            onChange={e => setDraft(d => ({ ...d, stripeProductId: e.target.value }))}
                            placeholder="prod_..."
                            className="bg-white/5 border-white/10 text-white text-xs h-8"
                        />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripeProductId ?? '— not set'}</code>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {editing && (
                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))}
                                className="rounded"
                            />
                            Show on pricing page
                        </label>
                    )}
                </div>
            </div>

            <div>
                <p className="text-xs text-zinc-500 mb-1">Features</p>
                {editing ? (
                    <textarea
                        value={draft.features}
                        onChange={e => setDraft(d => ({ ...d, features: e.target.value }))}
                        rows={4}
                        placeholder="One feature per line"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                ) : (
                    <ul className="space-y-1">
                        {plan.features.map(f => <li key={f} className="text-xs text-zinc-400">• {f}</li>)}
                    </ul>
                )}
            </div>
        </div>
    );
};

const PlansSection = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const { data: an, loading: anLoading } = useAnalytics();

    useEffect(() => {
        axiosInstance.get('/admin/plans')
            .then(r => setPlans(r.data.data))
            .catch(() => toast.error('Failed to load plans'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>;

    const tierBar = an?.tierDist.map(t => ({
        tier: t.tier,
        count: t.count,
        fill: (CHART_COLORS as any)[t.tier] ?? '#52525b',
    })) ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
                <p className="text-sm text-zinc-500 mt-1">Edit Stripe price IDs to link plans to Stripe products. Changes invalidate the Redis cache instantly.</p>
            </div>

            {/* Tier distribution chart */}
            {!anLoading && (
                <ChartCard title="Users per plan tier">
                    {tierBar.length === 0 ? <EmptyChart /> : (
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={tierBar} barCategoryGap="35%">
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="tier" tick={AXIS_STYLE} />
                                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
                                    {tierBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            )}

            <div className="space-y-4">
                {plans.map(p => (
                    <PlanRow key={p.slug} plan={p} onSaved={updated => setPlans(ps => ps.map(x => x.slug === updated.slug ? updated : x))} />
                ))}
            </div>
        </div>
    );
};

// ── Users section ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    active:               'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cancel_at_period_end: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    past_due:             'bg-red-500/15 text-red-400 border-red-500/30',
    canceled:             'bg-zinc-700 text-zinc-500 border-zinc-600',
};

const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' }) : '—';

const StripePanel = ({ user, onSaved }: { user: AdminUser; onSaved: (u: AdminUser) => void }) => {
    const [saving, setSaving] = useState(false);
    const [vals, setVals] = useState({
        stripeSubscriptionId: user.stripeSubscriptionId ?? '',
        stripeCustomerId:     user.stripeCustomerId     ?? '',
        subscriptionStatus:   user.subscriptionStatus   ?? '',
        currentPeriodEnd:     user.currentPeriodEnd ? user.currentPeriodEnd.slice(0, 10) : '',
    });

    const save = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.patch(`/admin/users/${user.clerkId}/subscription`, {
                stripeSubscriptionId: vals.stripeSubscriptionId || null,
                stripeCustomerId:     vals.stripeCustomerId     || null,
                subscriptionStatus:   vals.subscriptionStatus   || null,
                currentPeriodEnd:     vals.currentPeriodEnd     || null,
            });
            onSaved({ ...user, ...data.data });
            toast.success('Subscription data saved');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <div className="bg-zinc-900 border-t border-white/5 px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
                { label: 'Stripe Sub ID',           key: 'stripeSubscriptionId', placeholder: 'sub_...' },
                { label: 'Stripe Customer ID',      key: 'stripeCustomerId',     placeholder: 'cus_...' },
                { label: 'Status',                  key: 'subscriptionStatus',   placeholder: 'active / canceled ...' },
                { label: 'Period End (YYYY-MM-DD)', key: 'currentPeriodEnd',     placeholder: '2026-05-01' },
            ] as const).map(({ label, key, placeholder }) => (
                <div key={key}>
                    <p className="text-[10px] text-zinc-500 mb-1">{label}</p>
                    <Input
                        value={(vals as any)[key]}
                        onChange={e => setVals(v => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="bg-white/5 border-white/10 text-white text-xs h-7"
                    />
                </div>
            ))}
            <div className="col-span-2 md:col-span-4 flex justify-end">
                <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
                    {saving ? <Loader className="size-3 animate-spin" /> : <Check className="size-3.5" />} Save Stripe data
                </Button>
            </div>
        </div>
    );
};

const UsersSection = () => {
    const [users, setUsers]     = useState<AdminUser[]>([]);
    const [search, setSearch]   = useState('');
    const [page, setPage]       = useState(1);
    const [total, setTotal]     = useState(0);
    const [pages, setPages]     = useState(1);
    const [loading, setLoading] = useState(true);
    const [changingTier, setChangingTier] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const { data: an, loading: anLoading } = useAnalytics();

    const fetchUsers = async (s: string, p: number) => {
        setLoading(true);
        try {
            const { data } = await axiosInstance.get('/admin/users', { params: { search: s, page: p } });
            setUsers(data.data.users);
            setTotal(data.data.total);
            setPages(data.data.pages);
        } catch { toast.error('Failed to load users'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers('', 1); }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsers(search, 1);
    };

    const changeTier = async (clerkId: string, tier: string) => {
        setChangingTier(clerkId);
        try {
            await axiosInstance.patch(`/admin/users/${clerkId}/tier`, { tier });
            setUsers(us => us.map(u => u.clerkId === clerkId ? { ...u, userTier: tier } : u));
            toast.success('Tier updated');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Failed to update tier');
        } finally { setChangingTier(null); }
    };

    const dailySignups = sortByDateAsc(an?.dailySignups ?? []);
    const tierPie = an?.tierDist.map(t => ({ name: t.tier, value: t.count, color: (CHART_COLORS as any)[t.tier] ?? '#52525b' })) ?? [];
    const rangeDays = an?.days ?? 0;

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-white">Users</h2>
                <p className="text-sm text-zinc-500 mt-1">{total} total</p>
            </div>

            {/* Charts */}
            {!anLoading && an && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ChartCard title={`New signups (last ${rangeDays} days)`} className="md:col-span-2">
                        {dailySignups.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={140}>
                                <AreaChart data={dailySignups}>
                                    <defs>
                                        <linearGradient id="sig2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor={CHART_COLORS.signups} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.signups} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                                    <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} />
                                    <Area type="monotone" dataKey="count" name="Signups" stroke={CHART_COLORS.signups} fill="url(#sig2)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                    <ChartCard title="Tier breakdown">
                        {tierPie.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={tierPie} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                                        {tierPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TIP_STYLE} />
                                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, username, or Clerk ID…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                />
                <Button type="submit" variant="outline" className="border-white/10 text-zinc-300 hover:text-white shrink-0">Search</Button>
            </form>

            {loading ? (
                <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading…</div>
            ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-zinc-500">User</TableHead>
                                <TableHead className="text-zinc-500">Tier</TableHead>
                                <TableHead className="text-zinc-500 hidden md:table-cell">Status</TableHead>
                                <TableHead className="text-zinc-500 hidden lg:table-cell">Period end</TableHead>
                                <TableHead className="text-zinc-500 hidden lg:table-cell">Balance</TableHead>
                                <TableHead className="text-zinc-500 hidden xl:table-cell">Joined</TableHead>
                                <TableHead className="text-zinc-500 hidden xl:table-cell">Stripe</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(u => (
                                <>
                                    <TableRow
                                        key={u.clerkId}
                                        className="border-white/5 hover:bg-white/[0.03] cursor-pointer"
                                        onClick={() => setExpanded(e => e === u.clerkId ? null : u.clerkId)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <img src={u.imageUrl} className="size-7 rounded-full flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white font-medium truncate max-w-[140px]">{u.fullName}</p>
                                                    <p className="text-[11px] text-zinc-500 truncate">{u.username ? `@${u.username}` : u.clerkId.slice(0, 16) + '…'}</p>
                                                </div>
                                                {u.role === 'ADMIN' && <ShieldCheck className="size-3.5 text-purple-400 flex-shrink-0" />}
                                            </div>
                                        </TableCell>

                                        <TableCell onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5">
                                                <select
                                                    value={u.userTier}
                                                    disabled={changingTier === u.clerkId}
                                                    onChange={e => changeTier(u.clerkId, e.target.value)}
                                                    className={cn('text-xs bg-transparent border rounded-md px-1.5 py-0.5 cursor-pointer', TIER_COLORS[u.userTier])}
                                                >
                                                    <option value="FREE">FREE</option>
                                                    <option value="PREMIUM">PREMIUM</option>
                                                    <option value="CREATOR">CREATOR</option>
                                                </select>
                                                {changingTier === u.clerkId && <Loader className="size-3 animate-spin text-zinc-400" />}
                                            </div>
                                        </TableCell>

                                        <TableCell className="hidden md:table-cell">
                                            {u.subscriptionStatus ? (
                                                <span className={cn('text-[11px] px-2 py-0.5 rounded-full border', STATUS_STYLES[u.subscriptionStatus] ?? 'bg-zinc-700 text-zinc-400 border-zinc-600')}>
                                                    {u.subscriptionStatus.replace(/_/g, ' ')}
                                                </span>
                                            ) : <span className="text-xs text-zinc-600">—</span>}
                                        </TableCell>

                                        <TableCell className="hidden lg:table-cell text-xs text-zinc-400">{fmt(u.currentPeriodEnd)}</TableCell>
                                        <TableCell className="hidden lg:table-cell text-xs text-zinc-400">{u.balance.toLocaleString()} cr</TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs text-zinc-600">{fmt(u.createdAt)}</TableCell>

                                        <TableCell className="hidden xl:table-cell" onClick={e => e.stopPropagation()}>
                                            <div className="flex gap-2">
                                                {u.stripeCustomerId && (
                                                    <a href={`https://dashboard.stripe.com/test/customers/${u.stripeCustomerId}`} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-300" title="Stripe customer">
                                                        <ExternalLink className="size-3.5" />
                                                    </a>
                                                )}
                                                {u.stripeSubscriptionId && (
                                                    <a href={`https://dashboard.stripe.com/test/subscriptions/${u.stripeSubscriptionId}`} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-300" title="Stripe subscription">
                                                        <Link2 className="size-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <Pencil className={cn('size-3.5 transition-colors', expanded === u.clerkId ? 'text-white' : 'text-zinc-600')} />
                                        </TableCell>
                                    </TableRow>

                                    {expanded === u.clerkId && (
                                        <TableRow key={`${u.clerkId}-exp`} className="border-white/5">
                                            <TableCell colSpan={8} className="p-0">
                                                <StripePanel
                                                    user={u}
                                                    onSaved={updated => setUsers(us => us.map(x => x.clerkId === updated.clerkId ? updated : x))}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Page {page} of {pages}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => { const p = page-1; setPage(p); fetchUsers(search, p); }}>
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => { const p = page+1; setPage(p); fetchUsers(search, p); }}>
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Songs section ─────────────────────────────────────────────────────────────

const SongsSection = () => {
    const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
    const ALLOWED_AUDIO_MIME_TYPES = new Set([
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/flac',
        'audio/webm',
    ]);

    const [songs, setSongs]       = useState<Song[]>([]);
    const [loading, setLoading]   = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState<'idle' | 'requesting' | 'uploading' | 'finalizing'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [songAnalytics, setSongAnalytics] = useState<SongAnalytics | null>(null);
    const [songAnalyticsLoading, setSongAnalyticsLoading] = useState(true);
    const [songAnalyticsRefreshTick, setSongAnalyticsRefreshTick] = useState(0);
    const { data: an, loading: anLoading } = useAnalytics();

    const [form, setForm] = useState({
        title: '', artist: '', imageUrl: '', audioFile: null as File | null,
    });

    useEffect(() => {
        axiosInstance.get('/admin/songs')
            .then(r => setSongs(r.data.data))
            .catch(() => toast.error('Failed to load songs'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!an?.from || !an?.to) return;
        let canceled = false;
        const loadSongAnalytics = async () => {
            setSongAnalyticsLoading(true);
            try {
                const { data } = await axiosInstance.get('/admin/analytics/songs', {
                    params: {
                        from: an.from,
                        to: an.to,
                        granularity: an.granularity,
                    },
                });
                if (!canceled) setSongAnalytics(data.data);
            } catch (error) {
                if (!canceled) toast.error(getAxiosErrorMessage(error, 'Failed to load song analytics'));
            } finally {
                if (!canceled) setSongAnalyticsLoading(false);
            }
        };
        void loadSongAnalytics();
        return () => { canceled = true; };
    }, [an?.from, an?.to, an?.granularity, songAnalyticsRefreshTick]);

    const validateUploadForm = () => {
        const title = form.title.trim();
        const artist = form.artist.trim();
        const imageUrl = form.imageUrl.trim();
        const file = form.audioFile;

        if (!title || !artist || !imageUrl || !file) return 'All fields are required';
        if (title.length < 2 || artist.length < 2) return 'Title and artist must be at least 2 characters';
        if (!/^https?:\/\//i.test(imageUrl)) return 'Cover image URL must start with http:// or https://';
        if (!ALLOWED_AUDIO_MIME_TYPES.has(file.type.toLowerCase())) {
            return 'Unsupported audio format. Use mp3, wav, ogg, m4a, aac, flac, or webm.';
        }
        if (file.size <= 0 || file.size > MAX_AUDIO_UPLOAD_BYTES) {
            return `Audio file must be <= ${Math.round(MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024))}MB`;
        }
        return null;
    };

    const readAudioDuration = async (file: File) => new Promise<number>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const audio = document.createElement('audio');
        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            audio.removeAttribute('src');
            audio.load();
        };
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            const duration = Math.round(audio.duration);
            cleanup();
            if (!Number.isFinite(duration) || duration <= 0) {
                reject(new Error('Invalid audio duration'));
                return;
            }
            resolve(duration);
        };
        audio.onerror = () => {
            cleanup();
            reject(new Error('Unable to read audio metadata'));
        };
        audio.src = objectUrl;
    });

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateUploadForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setUploading(true);
        setUploadStage('requesting');
        setUploadProgress(0);
        try {
            const file = form.audioFile as File;

            // 1. Request one-time secure upload intent + pre-signed URL
            const { data: urlData } = await axiosInstance.post('/admin/songs/upload-url', {
                filename: file.name,
                contentType: file.type,
                sizeBytes: file.size,
            });
            const { url, s3Key, uploadToken } = urlData.data;

            // 2. Upload file directly to S3 with progress feedback
            setUploadStage('uploading');
            await axios.put(url, file, {
                headers: { 'Content-Type': file.type },
                onUploadProgress: (event) => {
                    if (!event.total) return;
                    setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                },
            });
            setUploadProgress(100);

            // 3. Extract duration from uploaded file metadata
            const duration = await readAudioDuration(file);

            // 4. Finalize song creation in DB (server verifies upload token + S3 object)
            setUploadStage('finalizing');
            const { data: songData } = await axiosInstance.post('/admin/songs', {
                title: form.title.trim(),
                artist: form.artist.trim(),
                imageUrl: form.imageUrl.trim(),
                s3Key,
                duration,
                uploadToken,
            });

            setSongs(s => [songData.data, ...s]);
            setForm({ title: '', artist: '', imageUrl: '', audioFile: null });
            setSongAnalyticsRefreshTick(t => t + 1);
            toast.success(`"${form.title}" uploaded`);
        } catch (error) {
            toast.error(getAxiosErrorMessage(error, 'Upload failed'));
        } finally {
            setUploading(false);
            setUploadStage('idle');
            setUploadProgress(0);
        }
    };

    const deleteSong = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            await axiosInstance.delete(`/admin/songs/${id}`);
            setSongs(s => s.filter(x => x._id !== id));
            setSongAnalyticsRefreshTick(t => t + 1);
            toast.success('Song deleted');
        } catch (error) {
            toast.error(getAxiosErrorMessage(error, 'Delete failed'));
        }
    };

    const uploadStageLabel = {
        idle: 'Idle',
        requesting: 'Securing upload session',
        uploading: 'Uploading to storage',
        finalizing: 'Finalizing song metadata',
    }[uploadStage];

    const playsPerPeriod = sortByDateAsc(songAnalytics?.playsPerPeriod ?? songAnalytics?.playsPerDay ?? []);
    const topSongs = songAnalytics?.topSongs ?? [];
    const skipRates = songAnalytics?.skipRates ?? [];
    const geoBreakdown = songAnalytics?.geoBreakdown ?? [];
    const summary = songAnalytics?.summary ?? { plays: 0, streams: 0, skippedPlays: 0, activeSongs: 0 };
    const avgStreamsPerPlay = summary.plays > 0 ? (summary.streams / summary.plays).toFixed(2) : '0.00';
    const overallSkipRate = summary.plays > 0 ? ((summary.skippedPlays / summary.plays) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Songs</h2>

            {!anLoading && an && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 border border-white/10 rounded-xl overflow-hidden divide-x divide-y md:divide-y-0 divide-white/10">
                        <div className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Song plays</span>
                            <span className="text-xl font-semibold text-white">{summary.plays.toLocaleString()}</span>
                        </div>
                        <div className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Streams</span>
                            <span className="text-xl font-semibold text-violet-300">{summary.streams.toLocaleString()}</span>
                        </div>
                        <div className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Avg streams/play</span>
                            <span className="text-xl font-semibold text-emerald-300">{avgStreamsPerPlay}</span>
                        </div>
                        <div className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Skip rate</span>
                            <span className="text-xl font-semibold text-amber-300">{overallSkipRate}%</span>
                        </div>
                        <div className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Active songs</span>
                            <span className="text-xl font-semibold text-sky-300">{summary.activeSongs.toLocaleString()}</span>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-600">
                        Song analytics range: {songAnalytics ? `${fmtDateTimeInput(songAnalytics.from)} → ${fmtDateTimeInput(songAnalytics.to)} (${songAnalytics.granularity})` : `${fmtDateTimeInput(an.from)} → ${fmtDateTimeInput(an.to)} (${an.granularity})`}
                    </p>

                    {songAnalyticsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading song analytics...</div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <ChartCard title="Playback trend (plays vs streams)">
                                {playsPerPeriod.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={playsPerPeriod}>
                                            <defs>
                                                <linearGradient id="songPlays" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.signups} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.signups} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="songStreams" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                            <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                            <YAxis yAxisId="plays" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis yAxisId="streams" orientation="right" tick={AXIS_STYLE} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                labelFormatter={value => fmtDateLong(String(value))}
                                            />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                            <Area yAxisId="plays" type="monotone" dataKey="plays" name="Plays" stroke={CHART_COLORS.signups} fill="url(#songPlays)" strokeWidth={2} dot={false} />
                                            <Area yAxisId="streams" type="monotone" dataKey="streams" name="Streams" stroke={CHART_COLORS.revenue} fill="url(#songStreams)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Top streamed songs">
                                {topSongs.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={Math.max(180, Math.min(10, topSongs.length) * 30)}>
                                        <BarChart data={topSongs.slice(0, 10)} layout="vertical" barCategoryGap="26%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                            <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="title"
                                                tick={{ ...AXIS_STYLE, fontSize: 11 }}
                                                width={130}
                                                tickFormatter={(value) => String(value).length > 22 ? `${String(value).slice(0, 22)}…` : String(value)}
                                            />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                formatter={(value, name, payload) => {
                                                    if (name === 'streams') {
                                                        const song = payload?.payload as SongAnalytics['topSongs'][number];
                                                        return [`${Number(value).toLocaleString()} streams · ${song.plays.toLocaleString()} plays`, `${song.artist}`];
                                                    }
                                                    return [value, name];
                                                }}
                                            />
                                            <Bar dataKey="streams" name="streams" fill={CHART_COLORS.revenue} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Skip rate by song">
                                {skipRates.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={skipRates.slice(0, 10)} barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                            <XAxis dataKey="title" tick={AXIS_STYLE} tickFormatter={(value) => String(value).length > 16 ? `${String(value).slice(0, 16)}…` : String(value)} />
                                            <YAxis tick={AXIS_STYLE} tickFormatter={(value) => `${value}%`} />
                                            <Tooltip
                                                contentStyle={TIP_STYLE}
                                                formatter={(value, _name, payload) => {
                                                    const row = payload?.payload as SongAnalytics['skipRates'][number];
                                                    return [`${Number(value)}%`, `${row.artist} · ${row.plays} plays`];
                                                }}
                                            />
                                            <Bar dataKey="skipRate" name="Skip rate" fill={CHART_COLORS.donations} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard title="Streams by country">
                                {geoBreakdown.length === 0 ? <EmptyChart /> : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={geoBreakdown} dataKey="streams" nameKey="country" outerRadius={76} innerRadius={44} paddingAngle={2}>
                                                {geoBreakdown.map((entry, idx) => (
                                                    <Cell key={`${entry.country}-${idx}`} fill={['#a78bfa', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#22d3ee', '#fb7185', '#a3e635'][idx % 8]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={TIP_STYLE} formatter={(value) => [Number(value).toLocaleString(), 'Streams']} />
                                            <Legend wrapperStyle={{ color: '#71717a', fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    )}

                    <ChartCard title="Top artists by song count">
                        {an.topArtists.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={Math.max(120, an.topArtists.length * 28)}>
                                <BarChart data={an.topArtists} layout="vertical" barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                    <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                                    <YAxis type="category" dataKey="artist" tick={{ ...AXIS_STYLE, fontSize: 11 }} width={90} />
                                    <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="songs" name="Songs" fill={CHART_COLORS.revenue} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            {/* Upload form */}
            <form onSubmit={handleUpload} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-300">Upload Song</p>
                    <span className="text-[11px] text-zinc-500">Secure flow: intent → upload → finalize</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        placeholder="Title"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        disabled={uploading}
                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                    />
                    <Input
                        placeholder="Artist"
                        value={form.artist}
                        onChange={e => setForm(f => ({ ...f, artist: e.target.value }))}
                        disabled={uploading}
                        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                    />
                </div>
                <Input
                    type="url"
                    placeholder="Cover image URL"
                    value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    disabled={uploading}
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                />
                <div className="flex items-center gap-3">
                    <label className={cn(
                        'flex items-center gap-2 text-sm px-4 py-2 rounded-lg border cursor-pointer transition-colors',
                        form.audioFile
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : 'border-white/10 text-zinc-400 bg-white/5 hover:bg-white/10',
                        uploading && 'opacity-70 pointer-events-none',
                    )}>
                        <Upload className="size-4" />
                        {form.audioFile ? form.audioFile.name : 'Choose audio file'}
                        <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/flac,audio/webm"
                            className="hidden"
                            disabled={uploading}
                            onChange={e => setForm(f => ({ ...f, audioFile: e.target.files?.[0] ?? null }))}
                        />
                    </label>
                    <Button type="submit" disabled={uploading} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                        {uploading ? <Loader className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading ? uploadStageLabel : 'Upload'}
                    </Button>
                </div>
                {form.audioFile && (
                    <div className="text-xs text-zinc-500">
                        {form.audioFile.type} · {formatBytes(form.audioFile.size)}
                    </div>
                )}
                {uploading && (
                    <div className="space-y-2">
                        <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-200"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-xs text-zinc-500">
                            {uploadStage === 'uploading' ? `${uploadStageLabel} (${uploadProgress}%)` : uploadStageLabel}
                        </p>
                    </div>
                )}
            </form>

            {/* Song list */}
            {loading ? (
                <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>
            ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                    {songs.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-zinc-600">No songs yet</div>
                    )}
                    {songs.map((s, i) => (
                        <div key={s._id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-white/5')}>
                            <img src={s.imageUrl} className="size-9 rounded object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{s.title}</p>
                                <p className="text-xs text-zinc-500">{s.artist}</p>
                            </div>
                            <span className="text-xs text-zinc-600 hidden md:block">{fmtDuration(s.duration)}</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteSong(s._id, s.title)}
                                className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── TopupPackages section ─────────────────────────────────────────────────────

const EMPTY_PKG = { packageId: '', name: '', priceUsd: 0, credits: 0, bonusPercent: 0, isFeatured: false, sortOrder: 0 };

const TopupSection = () => {
    const [packages, setPackages] = useState<TopupPkg[]>([]);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [editId, setEditId]     = useState<string | null>(null);
    const [showNew, setShowNew]   = useState(false);
    const [draft, setDraft]       = useState({ ...EMPTY_PKG });
    const { data: an, loading: anLoading } = useAnalytics();
    const rangeDays = an?.days ?? 0;
    const dailyRevenue = sortByDateAsc(an?.dailyRevenue ?? []);
    const donationsByDay = sortByDateAsc(an?.donationsByDay ?? []);

    useEffect(() => {
        axiosInstance.get('/admin/topup-packages')
            .then(r => setPackages(r.data.data))
            .catch(() => toast.error('Failed to load packages'))
            .finally(() => setLoading(false));
    }, []);

    const startEdit = (pkg: TopupPkg) => {
        setEditId(pkg.packageId);
        setDraft({ packageId: pkg.packageId, name: pkg.name, priceUsd: pkg.priceUsd, credits: pkg.credits, bonusPercent: pkg.bonusPercent, isFeatured: pkg.isFeatured, sortOrder: pkg.sortOrder });
        setShowNew(false);
    };

    const saveEdit = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.patch(`/admin/topup-packages/${editId}`, draft);
            setPackages(ps => ps.map(p => p.packageId === editId ? data.data : p));
            setEditId(null);
            toast.success('Package updated');
        } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Save failed'); }
        finally { setSaving(false); }
    };

    const createPkg = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.post('/admin/topup-packages', draft);
            setPackages(ps => [...ps, data.data]);
            setShowNew(false);
            setDraft({ ...EMPTY_PKG });
            toast.success('Package created');
        } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Create failed'); }
        finally { setSaving(false); }
    };

    const toggleActive = async (pkg: TopupPkg) => {
        try {
            const { data } = await axiosInstance.patch(`/admin/topup-packages/${pkg.packageId}`, { isActive: !pkg.isActive });
            setPackages(ps => ps.map(p => p.packageId === pkg.packageId ? data.data : p));
        } catch { toast.error('Failed to toggle'); }
    };

    const deletePkg = async (packageId: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        try {
            await axiosInstance.delete(`/admin/topup-packages/${packageId}`);
            setPackages(ps => ps.filter(p => p.packageId !== packageId));
            toast.success('Package deleted');
        } catch { toast.error('Delete failed'); }
    };

    const DraftForm = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
                {!editId && (
                    <div>
                        <p className="text-xs text-zinc-500 mb-1">Package ID (slug)</p>
                        <Input value={draft.packageId} onChange={e => setDraft(d => ({ ...d, packageId: e.target.value }))}
                            placeholder="e.g. starter" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    </div>
                )}
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Name</p>
                    <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Starter" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Price (cents)</p>
                    <Input type="number" value={draft.priceUsd} onChange={e => setDraft(d => ({ ...d, priceUsd: Number(e.target.value) }))}
                        placeholder="500 = $5.00" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Credits</p>
                    <Input type="number" value={draft.credits} onChange={e => setDraft(d => ({ ...d, credits: Number(e.target.value) }))}
                        className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Bonus %</p>
                    <Input type="number" value={draft.bonusPercent} onChange={e => setDraft(d => ({ ...d, bonusPercent: Number(e.target.value) }))}
                        className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Sort order</p>
                    <Input type="number" value={draft.sortOrder} onChange={e => setDraft(d => ({ ...d, sortOrder: Number(e.target.value) }))}
                        className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={draft.isFeatured} onChange={e => setDraft(d => ({ ...d, isFeatured: e.target.checked }))} />
                Featured (Most Popular badge)
            </label>
            <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={onCancel} className="text-zinc-400"><X className="size-3.5" /></Button>
                <Button size="sm" onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">
                    {saving ? <Loader className="size-3 animate-spin" /> : <Check className="size-3.5" />} Save
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white">Top-up Packages</h2>
                    <p className="text-sm text-zinc-500 mt-1">Manage credit packages shown on the Wallet page.</p>
                </div>
                <Button size="sm" onClick={() => { setShowNew(true); setEditId(null); setDraft({ ...EMPTY_PKG }); }}
                    className="bg-white/10 hover:bg-white/15 text-white gap-1.5">
                    <Plus className="size-3.5" /> New package
                </Button>
            </div>

            {/* Revenue charts */}
            {!anLoading && an && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChartCard title={`Daily top-up revenue (last ${rangeDays} days)`}>
                        {dailyRevenue.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={dailyRevenue} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${(v/100).toFixed(0)}`} />
                                    <Tooltip
                                        contentStyle={TIP_STYLE}
                                        labelFormatter={value => fmtDateLong(String(value))}
                                        formatter={(v) => [`$${(Number(v)/100).toFixed(2)}`, 'Revenue']}
                                    />
                                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                    <ChartCard title={`Donations per day (last ${rangeDays} days)`}>
                        {donationsByDay.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={140}>
                                <AreaChart data={donationsByDay}>
                                    <defs>
                                        <linearGradient id="don" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor={CHART_COLORS.donations} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.donations} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${(v/100).toFixed(0)}`} />
                                    <Tooltip
                                        contentStyle={TIP_STYLE}
                                        labelFormatter={value => fmtDateLong(String(value))}
                                        formatter={(v) => [`$${(Number(v)/100).toFixed(2)}`, 'Donations']}
                                    />
                                    <Area type="monotone" dataKey="amount" name="Donations" stroke={CHART_COLORS.donations} fill="url(#don)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            {showNew && <DraftForm onSave={createPkg} onCancel={() => setShowNew(false)} />}

            {loading ? (
                <div className="flex items-center gap-2 text-zinc-400"><Loader className="size-4 animate-spin" /> Loading...</div>
            ) : (
                <div className="space-y-3">
                    {packages.map(pkg => (
                        <div key={pkg.packageId}>
                            {editId === pkg.packageId ? (
                                <DraftForm onSave={saveEdit} onCancel={() => setEditId(null)} />
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-white text-sm">{pkg.name}</span>
                                            {pkg.isFeatured && <Star className="size-3 text-yellow-400 fill-yellow-400" />}
                                            <code className="text-xs text-zinc-600">{pkg.packageId}</code>
                                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', pkg.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500')}>
                                                {pkg.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400">
                                            ${(pkg.priceUsd / 100).toFixed(2)} → {pkg.credits.toLocaleString()} credits
                                            {pkg.bonusPercent > 0 && ` (+${pkg.bonusPercent}% bonus)`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                        <Button size="sm" variant="ghost" onClick={() => toggleActive(pkg)} className="text-zinc-500 hover:text-zinc-300 text-xs">
                                            {pkg.isActive ? 'Deactivate' : 'Activate'}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => startEdit(pkg)} className="text-zinc-400 hover:text-white">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => deletePkg(pkg.packageId, pkg.name)} className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10">
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV = [
    { id: 'overview', label: 'Overview',       icon: LayoutDashboard },
    { id: 'plans',    label: 'Plans',          icon: CreditCard },
    { id: 'topup',    label: 'Top-up Packages',icon: Package },
    { id: 'users',    label: 'Users',          icon: Users },
    { id: 'songs',    label: 'Songs',          icon: Music2 },
] as const;

type Section = typeof NAV[number]['id'];

// ── Main page ─────────────────────────────────────────────────────────────────

export const AdminPage = () => {
    const { isAdmin, isLoading } = useAuthStore();
    const [section, setSection] = useState<Section>('overview');
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [initialRange] = useState(() => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86_400_000);
        return {
            to: toDateTimeInputValue(to),
            from: toDateTimeInputValue(from),
        };
    });
    const [analyticsGranularity, setAnalyticsGranularity] = useState<AnalyticsGranularity>('daily');
    const [analyticsFrom, setAnalyticsFrom] = useState(initialRange.from);
    const [analyticsTo, setAnalyticsTo] = useState(initialRange.to);
    const [appliedGranularity, setAppliedGranularity] = useState<AnalyticsGranularity>('daily');
    const [appliedFrom, setAppliedFrom] = useState(initialRange.from);
    const [appliedTo, setAppliedTo] = useState(initialRange.to);
    const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);

    const applyAnalyticsRange = () => {
        const fromDate = toDate(analyticsFrom);
        const toDateValue = toDate(analyticsTo);
        if (!fromDate || !toDateValue) {
            toast.error('Invalid date range');
            return;
        }
        if (fromDate >= toDateValue) {
            toast.error('From time must be before To time');
            return;
        }
        setAnalyticsLoading(true);
        setAppliedGranularity(analyticsGranularity);
        setAppliedFrom(analyticsFrom);
        setAppliedTo(analyticsTo);
    };

    useEffect(() => {
        let canceled = false;
        const fromIso = toDate(appliedFrom)?.toISOString();
        const toIso = toDate(appliedTo)?.toISOString();
        axiosInstance.get('/admin/analytics', {
            params: {
                granularity: appliedGranularity,
                from: fromIso,
                to: toIso,
            },
        })
            .then(r => { if (!canceled) setAnalytics(r.data.data); })
            .catch(() => { if (!canceled) toast.error('Failed to load analytics'); })
            .finally(() => { if (!canceled) setAnalyticsLoading(false); });
        return () => { canceled = true; };
    }, [appliedGranularity, appliedFrom, appliedTo, analyticsRefreshTick]);

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
            <Loader className="size-6 animate-spin text-zinc-400" />
        </div>
    );

    if (!isAdmin) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
            Unauthorized
        </div>
    );

    return (
        <AnalyticsCtx.Provider
            value={{
                data: analytics,
                loading: analyticsLoading,
                granularity: analyticsGranularity,
                setGranularity: setAnalyticsGranularity,
                from: analyticsFrom,
                setFrom: setAnalyticsFrom,
                to: analyticsTo,
                setTo: setAnalyticsTo,
                applyRange: applyAnalyticsRange,
                refresh: () => {
                    setAnalyticsLoading(true);
                    setAnalyticsRefreshTick(v => v + 1);
                },
            }}
        >
            <div className="min-h-screen bg-zinc-950 flex">
                {/* Sidebar */}
                <aside className="w-56 border-r border-white/5 p-4 flex flex-col gap-1 shrink-0">
                    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-3">Admin</p>
                    {NAV.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setSection(id)}
                            className={cn(
                                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                                section === id
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
                            )}
                        >
                            <Icon className="size-4" />
                            {label}
                        </button>
                    ))}
                </aside>

                {/* Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {section === 'overview' && <OverviewSection />}
                        {section === 'plans'    && <PlansSection />}
                        {section === 'topup'    && <TopupSection />}
                        {section === 'users'    && <UsersSection />}
                        {section === 'songs'    && <SongsSection />}
                    </div>
                </main>
            </div>
        </AnalyticsCtx.Provider>
    );
};
