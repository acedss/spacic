import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader, Pencil, Check, X } from 'lucide-react';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAnalytics } from '../AnalyticsContext';
import { ChartCard, EmptyChart, CHART_COLORS, AXIS_STYLE, GRID_STROKE, TIP_STYLE } from '../ChartCard';
import { type Plan, TIER_COLORS } from '../admin-shared';

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
                        <Input value={draft.stripePriceIdMonthly} onChange={e => setDraft(d => ({ ...d, stripePriceIdMonthly: e.target.value }))} placeholder="price_..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripePriceIdMonthly ?? '— not set'}</code>
                    )}
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Yearly Price ID</p>
                    {editing ? (
                        <Input value={draft.stripePriceIdYearly} onChange={e => setDraft(d => ({ ...d, stripePriceIdYearly: e.target.value }))} placeholder="price_... (optional)" className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripePriceIdYearly ?? '— not set'}</code>
                    )}
                </div>
                <div>
                    <p className="text-xs text-zinc-500 mb-1">Stripe Product ID</p>
                    {editing ? (
                        <Input value={draft.stripeProductId} onChange={e => setDraft(d => ({ ...d, stripeProductId: e.target.value }))} placeholder="prod_..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    ) : (
                        <code className="text-xs text-zinc-400">{plan.stripeProductId ?? '— not set'}</code>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {editing && (
                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} className="rounded" />
                            Show on pricing page
                        </label>
                    )}
                </div>
            </div>

            <div>
                <p className="text-xs text-zinc-500 mb-1">Features</p>
                {editing ? (
                    <textarea value={draft.features} onChange={e => setDraft(d => ({ ...d, features: e.target.value }))} rows={4} placeholder="One feature per line" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-white/20" />
                ) : (
                    <ul className="space-y-1">
                        {plan.features.map(f => <li key={f} className="text-xs text-zinc-400">• {f}</li>)}
                    </ul>
                )}
            </div>
        </div>
    );
};

export const PlansSection = () => {
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
        tier: t.tier, count: t.count,
        fill: (CHART_COLORS as any)[t.tier] ?? '#52525b',
    })) ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
                <p className="text-sm text-zinc-500 mt-1">Edit Stripe price IDs to link plans to Stripe products. Changes invalidate the Redis cache instantly.</p>
            </div>

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
