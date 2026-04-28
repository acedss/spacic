import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ExternalLink, BellOff } from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import { cn } from '@/lib/utils';

interface Alert {
    _id: string;
    severity: 'critical' | 'warning' | 'info';
    status: 'firing' | 'resolved' | 'acknowledged';
    title: string;
    message: string;
    ruleName: string;
    valueString: string;
    dashboardUrl: string;
    panelUrl: string;
    raisedAt: string;
    lastSeenAt: string;
    resolvedAt: string | null;
    acknowledgedAt: string | null;
}

const severityIcon = {
    critical: AlertCircle,
    warning:  AlertTriangle,
    info:     Info,
};

const severityClass = {
    critical: 'text-red-400 bg-red-500/10 ring-red-500/30',
    warning:  'text-amber-400 bg-amber-500/10 ring-amber-500/30',
    info:     'text-blue-400 bg-blue-500/10 ring-blue-500/30',
};

const statusClass = {
    firing:       'text-red-400',
    acknowledged: 'text-amber-400',
    resolved:     'text-emerald-400',
};

export const AlertsSection = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [summary, setSummary] = useState<{ firing?: number; acknowledged?: number; resolved?: number }>({});
    const [filter, setFilter] = useState<'all' | 'firing' | 'acknowledged' | 'resolved'>('firing');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const params: Record<string, string> = { limit: '100' };
            if (filter !== 'all') params.status = filter;
            const { data } = await axiosInstance.get('/admin/alerts', { params });
            setAlerts(data.alerts || []);
            setSummary(data.summary || {});
        } catch (e) {
            console.error('[AlertsSection] load failed', e);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
        // Poll every 30s — alerts are low-volume, this is fine without sockets
        const t = setInterval(load, 30_000);
        return () => clearInterval(t);
    }, [load]);

    const ack = async (id: string) => {
        try {
            await axiosInstance.patch(`/admin/alerts/${id}/ack`);
            await load();
        } catch (e) { console.error('[AlertsSection] ack failed', e); }
    };

    return (
        <div className="space-y-4">
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
                {(['firing', 'acknowledged', 'resolved'] as const).map((k) => (
                    <button
                        key={k}
                        onClick={() => setFilter(k)}
                        className={cn(
                            'rounded-2xl ring-1 px-4 py-3 text-left press transition-all',
                            filter === k ? 'ring-white/25 bg-white/8' : 'ring-white/10 hover:bg-white/4',
                        )}>
                        <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                            {k}
                        </p>
                        <p className={cn('text-2xl serif mt-1', statusClass[k])}>
                            {summary[k] ?? 0}
                        </p>
                    </button>
                ))}
            </div>

            {/* Filter chip — show "all" toggle */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setFilter('all')}
                    className={cn(
                        'mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full ring-1 transition-colors press',
                        filter === 'all' ? 'ring-white/30 bg-white/8 text-white' : 'ring-white/10 hover:bg-white/4',
                    )}
                    style={filter === 'all' ? {} : { color: 'var(--fg-3)' }}>
                    Show all
                </button>
                <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
                    {alerts.length} shown · auto-refresh 30s
                </p>
            </div>

            {/* Alert list */}
            {loading ? (
                <p className="text-center py-12 text-[12px]" style={{ color: 'var(--fg-3)' }}>Loading…</p>
            ) : alerts.length === 0 ? (
                <div className="rounded-2xl ring-1 ring-white/10 py-16 text-center">
                    <BellOff className="size-8 mx-auto mb-3 opacity-30 text-white" />
                    <p className="text-[13px]" style={{ color: 'var(--fg-2)' }}>No {filter === 'all' ? '' : filter} alerts</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--fg-3)' }}>
                        Alerts from Grafana arrive here automatically.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((a) => {
                        const Icon = severityIcon[a.severity];
                        return (
                            <div key={a._id}
                                className={cn('rounded-xl ring-1 px-4 py-3 flex gap-3 items-start', severityClass[a.severity])}>
                                <Icon className="size-4 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-[13px] font-medium text-white">{a.title}</p>
                                        <span className={cn('mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded', statusClass[a.status])}>
                                            {a.status}
                                        </span>
                                    </div>
                                    {a.message && (
                                        <p className="text-[11px] mt-1" style={{ color: 'var(--fg-2)' }}>{a.message}</p>
                                    )}
                                    {a.valueString && (
                                        <p className="mono text-[10px] mt-1" style={{ color: 'var(--fg-3)' }}>{a.valueString}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
                                            {new Date(a.raisedAt).toLocaleString()}
                                        </span>
                                        {a.panelUrl && (
                                            <a href={a.panelUrl} target="_blank" rel="noreferrer"
                                                className="mono text-[10px] flex items-center gap-1 hover:text-white"
                                                style={{ color: 'var(--fg-3)' }}>
                                                Open panel <ExternalLink className="size-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {a.status === 'firing' && (
                                    <button
                                        onClick={() => ack(a._id)}
                                        className="press rounded-lg ring-1 ring-white/15 px-2.5 py-1.5 text-[11px] hover:bg-white/10 flex items-center gap-1.5 self-center">
                                        <CheckCircle2 className="size-3.5" />
                                        Ack
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
