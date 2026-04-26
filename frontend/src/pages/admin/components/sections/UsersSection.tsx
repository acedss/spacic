import { Fragment, useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Loader, Pencil, Check, ChevronLeft, ChevronRight, Star,
    ExternalLink, ShieldCheck, Link2,
} from 'lucide-react';
import {
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAnalytics } from '../AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';
import {
    type AdminUser, TIER_COLORS, STATUS_STYLES,
    fmtDateShort, fmtDateLong, fmtShortDate, sortByDateAsc,
} from '../admin-shared';

const StripePanel = ({ user, onSaved }: { user: AdminUser; onSaved: (u: AdminUser) => void }) => {
    const [saving, setSaving] = useState(false);
    const [vals, setVals] = useState({
        stripeSubscriptionId: user.stripeSubscriptionId ?? '',
        stripeCustomerId:     user.stripeCustomerId     ?? '',
        subscriptionStatus:   user.subscriptionStatus   ?? '',
        currentPeriodEnd:     user.currentPeriodEnd ? user.currentPeriodEnd.slice(0, 10) : '',
    });

    const [giftAmount, setGiftAmount] = useState<string>('');
    const [giftReason, setGiftReason] = useState<string>('');
    const [gifting, setGifting]       = useState(false);

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

    const sendGift = async () => {
        const amount = Number(giftAmount);
        if (!Number.isFinite(amount) || amount === 0) {
            toast.error('Enter a non-zero amount');
            return;
        }
        setGifting(true);
        try {
            const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${user.clerkId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

            const { data } = await axiosInstance.post(`/admin/users/${user.clerkId}/gift-coins`, {
                amount, reason: giftReason.trim(), idempotencyKey,
            });
            onSaved({ ...user, balance: data.data.newBalance });
            toast.success(`${amount > 0 ? 'Gifted' : 'Adjusted'} ${Math.abs(amount).toLocaleString()} coins → balance now ${data.data.newBalance.toLocaleString()}`);
            setGiftAmount(''); setGiftReason('');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Gift failed');
        } finally { setGifting(false); }
    };

    return (
        <div className="bg-zinc-900 border-t border-white/5 divide-y divide-white/5">
            <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
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

            <div className="px-4 py-4 bg-rose-950/10">
                <div className="flex items-center gap-2 mb-3">
                    <Star className="size-3.5 text-rose-400" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">Wallet — gift / adjust coins</p>
                    <span className="text-[10px] text-zinc-500 ml-auto">Current: {user.balance.toLocaleString()} 🪙</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-end">
                    <div>
                        <p className="text-[10px] text-zinc-500 mb-1">Amount (negative = debit)</p>
                        <Input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} placeholder="500" className="bg-white/5 border-white/10 text-white text-xs h-7" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 mb-1">Reason (shown to user in notification)</p>
                        <Input value={giftReason} onChange={e => setGiftReason(e.target.value)} placeholder="Welcome bonus / contest prize / refund / …" className="bg-white/5 border-white/10 text-white text-xs h-7" />
                    </div>
                    <Button size="sm" onClick={sendGift} disabled={gifting || !giftAmount} className="bg-rose-600 hover:bg-rose-500 text-white gap-1.5 h-7">
                        {gifting ? <Loader className="size-3 animate-spin" /> : <Star className="size-3" />}
                        {Number(giftAmount) < 0 ? 'Debit' : 'Send gift'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const UsersSection = () => {
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
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, username, or Clerk ID…" className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600" />
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
                                <Fragment key={u.clerkId}>
                                    <TableRow
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

                                        <TableCell className="hidden lg:table-cell text-xs text-zinc-400">{fmtShortDate(u.currentPeriodEnd)}</TableCell>
                                        <TableCell className="hidden lg:table-cell text-xs text-zinc-400">{u.balance.toLocaleString()} cr</TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs text-zinc-600">{fmtShortDate(u.createdAt)}</TableCell>

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
                                        <TableRow className="border-white/5">
                                            <TableCell colSpan={8} className="p-0">
                                                <StripePanel
                                                    user={u}
                                                    onSaved={updated => setUsers(us => us.map(x => x.clerkId === updated.clerkId ? updated : x))}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
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
