import { useEffect, useState } from 'react';
import axios from 'axios';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Loader, Clock, BrainCircuit, RefreshCw, WifiOff, PlayCircle, Database, Zap, BarChart2,
} from 'lucide-react';

interface RecSysStatus {
    service: string;
    model: {
        version: string;
        trained_at: string | null;
        duration_s: number | null;
        metrics: {
            precision_at_10: number | null;
            coverage: number | null;
            training_users: number;
            training_songs: number;
            training_interactions: number;
        };
    };
    cache: {
        users_cached: number;
        hit_rate_pct: number;
        total_requests: number;
        cache_hits: number;
    };
    scheduler: {
        last_run_at: string | null;
        last_run_duration_s: number | null;
        is_training: boolean;
    };
}

export const RecSysSection = () => {
    const [status, setStatus] = useState<RecSysStatus | null>(null);
    const [offline, setOffline]   = useState(false);
    const [loading, setLoading]   = useState(true);
    const [training, setTraining] = useState(false);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const r = await axiosInstance.get('/admin/recsys/status');
            setStatus(r.data.data);
            setOffline(false);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.data?.offline) setOffline(true);
            else toast.error('Failed to load RecSys status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, []);

    const triggerTrain = async (force = false) => {
        setTraining(true);
        try {
            await axiosInstance.post('/admin/recsys/train', { force });
            toast.success('Training started — this runs in the background');
            setTimeout(fetchStatus, 3000);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 409) toast.warning('Training already in progress');
            else toast.error('Failed to trigger training');
        } finally {
            setTraining(false);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-2 text-zinc-400">
            <Loader className="size-4 animate-spin" /> Loading RecSys status...
        </div>
    );

    if (offline) return (
        <div className="flex flex-col items-center gap-4 py-20 text-zinc-500">
            <WifiOff className="size-10 text-red-500/50" />
            <p className="text-sm">RecSys service is <span className="text-red-400 font-medium">offline</span></p>
            <p className="text-xs text-zinc-600">Start it with: <code className="bg-zinc-900 px-2 py-0.5 rounded text-zinc-300">cd recsys && uvicorn src.main:app --port 8000</code></p>
            <Button size="sm" variant="outline" onClick={fetchStatus} className="mt-2 border-zinc-700">
                <RefreshCw className="size-3.5 mr-2" /> Retry
            </Button>
        </div>
    );

    if (!status) return null;

    const isTraining = status.scheduler.is_training || training;
    const lastTrained = status.model.trained_at ? new Date(status.model.trained_at).toLocaleString() : 'Never';
    const neverTrained = status.model.version === 'none';

    const statCards = [
        { label: 'Model Version',  value: neverTrained ? '—' : status.model.version.slice(0, 10) + '…', sub: `Trained: ${lastTrained}`, icon: BrainCircuit, color: 'text-violet-400' },
        { label: 'Cache Hit Rate', value: `${status.cache.hit_rate_pct}%`, sub: `${status.cache.users_cached.toLocaleString()} users cached`, icon: Zap, color: 'text-emerald-400' },
        { label: 'Total Requests', value: status.cache.total_requests.toLocaleString(), sub: `${status.cache.cache_hits.toLocaleString()} served from cache`, icon: BarChart2, color: 'text-sky-400' },
        { label: 'Training Scale', value: status.model.metrics.training_users.toLocaleString(), sub: `users · ${status.model.metrics.training_songs.toLocaleString()} songs`, icon: Database, color: 'text-amber-400' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <BrainCircuit className="size-5 text-violet-400" />
                        Recommendation Engine
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">ALS collaborative filtering · nightly training at 02:00 UTC</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={fetchStatus} className="border-zinc-700 text-zinc-400">
                        <RefreshCw className="size-3.5 mr-2" /> Refresh
                    </Button>
                    <Button size="sm" onClick={() => triggerTrain()} disabled={isTraining} className="bg-violet-600 hover:bg-violet-700 text-white">
                        {isTraining
                            ? <><Loader className="size-3.5 mr-2 animate-spin" /> Training…</>
                            : <><PlayCircle className="size-3.5 mr-2" /> Train Now</>}
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-zinc-400">
                    Service <span className="text-emerald-400 font-medium">online</span>
                    {isTraining && <span className="ml-3 text-amber-400 text-xs font-medium">● Training in progress…</span>}
                </span>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {statCards.map(card => (
                    <div key={card.label} className="bg-zinc-900 border border-white/5 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <card.icon className={cn('size-4', card.color)} />
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">{card.label}</span>
                        </div>
                        <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                        <p className="text-xs text-zinc-600 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <BrainCircuit className="size-4 text-violet-400" /> Model Metrics
                    </h3>
                    {neverTrained ? (
                        <p className="text-zinc-600 text-sm">No model trained yet. Click <strong className="text-zinc-400">Train Now</strong> to run the first training.</p>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Coverage</span>
                                <span className="text-white font-medium">{status.model.metrics.coverage != null ? `${(status.model.metrics.coverage * 100).toFixed(1)}%` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Precision@10</span>
                                <span className="text-white font-medium">{status.model.metrics.precision_at_10 != null ? status.model.metrics.precision_at_10.toFixed(3) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Interactions</span>
                                <span className="text-white font-medium">{status.model.metrics.training_interactions.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Training time</span>
                                <span className="text-white font-medium">{status.model.duration_s != null ? `${status.model.duration_s.toFixed(1)}s` : '—'}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <Clock className="size-4 text-sky-400" /> Scheduler
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-zinc-500">Schedule</span>
                            <span className="text-white font-medium">Nightly 02:00 UTC</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500">Last run</span>
                            <span className="text-white font-medium">{lastTrained}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500">Last duration</span>
                            <span className="text-white font-medium">{status.scheduler.last_run_duration_s != null ? `${status.scheduler.last_run_duration_s.toFixed(1)}s` : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500">Status</span>
                            <Badge className={cn(isTraining ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30')}>
                                {isTraining ? 'Training…' : 'Idle'}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 text-xs text-zinc-600 space-y-1">
                <p className="text-zinc-500 font-medium mb-2">Architecture</p>
                <p>Node.js backend (port 4000) → HTTP proxy → Python RecSys service (port 8000)</p>
                <p>Python reads <code className="text-zinc-400">ListenEvents</code> from MongoDB → builds ALS model → writes top-50 recs per user to Redis</p>
                <p>Recommendations are served from Redis cache (&lt;1ms). Cache miss falls back to content-based → popularity.</p>
            </div>
        </div>
    );
};
