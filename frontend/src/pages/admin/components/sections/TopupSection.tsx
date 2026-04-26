import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Pencil, Check, X, Trash2, Plus, Star } from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAnalytics } from '../AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';
import { type TopupPkg, fmtDateShort, fmtDateLong, sortByDateAsc } from '../admin-shared';

const EMPTY_PKG = { packageId: '', name: '', priceUsd: 0, credits: 0, bonusPercent: 0, isFeatured: false, sortOrder: 0 };

export const TopupSection = () => {
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
                        <Input value={draft.packageId} onChange={e => setDraft(d => ({ ...d, packageId: e.target.value }))} placeholder="e.g. starter" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    </div>
                )}
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Name</p>
                    <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Starter" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Price (cents)</p>
                    <Input type="number" value={draft.priceUsd} onChange={e => setDraft(d => ({ ...d, priceUsd: Number(e.target.value) }))} placeholder="500 = $5.00" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Credits</p>
                    <Input type="number" value={draft.credits} onChange={e => setDraft(d => ({ ...d, credits: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-zinc-500">Bonus %</p>
                        {(() => {
                            const suggested = draft.priceUsd > 0
                                ? Math.round(((draft.credits / draft.priceUsd) - 1) * 100)
                                : null;
                            const stale = suggested !== null && suggested !== draft.bonusPercent;
                            return suggested !== null && suggested >= 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setDraft(d => ({ ...d, bonusPercent: suggested }))}
                                    className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded transition-colors',
                                        stale ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-zinc-600 bg-white/5',
                                    )}
                                    title="Click to apply suggested bonus based on credits/price ratio"
                                >
                                    {stale ? `Apply ${suggested}%` : `auto: ${suggested}%`}
                                </button>
                            ) : null;
                        })()}
                    </div>
                    <Input type="number" value={draft.bonusPercent} onChange={e => setDraft(d => ({ ...d, bonusPercent: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white text-xs h-8" />
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Sort order</p>
                    <Input type="number" value={draft.sortOrder} onChange={e => setDraft(d => ({ ...d, sortOrder: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white text-xs h-8" />
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
                <Button size="sm" onClick={() => { setShowNew(true); setEditId(null); setDraft({ ...EMPTY_PKG }); }} className="bg-white/10 hover:bg-white/15 text-white gap-1.5">
                    <Plus className="size-3.5" /> New package
                </Button>
            </div>

            {!anLoading && an && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChartCard title={`Daily top-up revenue (last ${rangeDays} days)`}>
                        {dailyRevenue.length === 0 ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={dailyRevenue} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={fmtDateShort} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${(v/100).toFixed(0)}`} />
                                    <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} formatter={(v) => [`$${(Number(v)/100).toFixed(2)}`, 'Revenue']} />
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
                                    <Tooltip contentStyle={TIP_STYLE} labelFormatter={value => fmtDateLong(String(value))} formatter={(v) => [`$${(Number(v)/100).toFixed(2)}`, 'Donations']} />
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
