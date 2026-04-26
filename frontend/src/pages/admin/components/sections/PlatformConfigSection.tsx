import { useEffect, useState } from 'react';
import axios from 'axios';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from 'lucide-react';

interface PlatformConfig {
    withdrawFeePercent:    number;
    minWithdrawWinPoints:  number;
    winPointsToUsdCents:   number;
}

export const PlatformConfigSection = () => {
    const [config, setConfig]   = useState<PlatformConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [draft, setDraft]     = useState<PlatformConfig>({ withdrawFeePercent: 20, minWithdrawWinPoints: 2000, winPointsToUsdCents: 1 });

    useEffect(() => {
        axiosInstance.get('/admin/config')
            .then(({ data }) => {
                setConfig(data.data);
                setDraft(data.data);
            })
            .catch(() => toast.error('Failed to load config'))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.patch('/admin/config', draft);
            setConfig(data.data);
            toast.success('Platform config updated');
        } catch (err) {
            const msg = axios.isAxiosError<{ message?: string }>(err)
                ? err.response?.data?.message ?? 'Save failed'
                : 'Save failed';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof PlatformConfig, hint: string, min: number, max?: number) => (
        <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
            <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>
            </div>
            <Input
                type="number" min={min} max={max}
                value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-28 bg-white/5 border-white/10 text-white text-right h-9 tabular-nums"
            />
        </div>
    );

    return (
        <div className="max-w-xl space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-white">Platform Configuration</h2>
                <p className="text-sm text-zinc-500 mt-1">Adjust WinPoints economy and payout rates.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader className="size-5 text-zinc-500 animate-spin" />
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5">
                    {field('Withdrawal fee (%)', 'withdrawFeePercent', 'Platform fee deducted on each WinPoints payout', 0, 50)}
                    {field('Min withdrawal (WP)', 'minWithdrawWinPoints', 'Minimum WinPoints required to initiate a withdrawal', 100)}
                    {field('WP → USD cents rate', 'winPointsToUsdCents', '1 WinPoint = N USD cents (e.g. 1 = $0.01/WP)', 1)}
                </div>
            )}

            {config && (
                <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
                    <p>Current: fee <span className="text-white">{config.withdrawFeePercent}%</span> · min <span className="text-white">{config.minWithdrawWinPoints.toLocaleString()} WP</span> · rate <span className="text-white">{config.winPointsToUsdCents}¢/WP</span></p>
                    <p>Min withdrawal = <span className="text-white">${(config.minWithdrawWinPoints * config.winPointsToUsdCents / 100).toFixed(2)}</span> gross (before fee)</p>
                </div>
            )}

            <Button onClick={handleSave} disabled={saving || loading} className="bg-violet-600 hover:bg-violet-500 text-white">
                {saving ? <Loader className="size-4 animate-spin mr-2" /> : null}
                Save Changes
            </Button>
        </div>
    );
};
