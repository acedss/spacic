import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, CreditCard, Users, Music2, Package,
    Loader, TrendingUp, BrainCircuit, RefreshCw, Zap,
} from 'lucide-react';
import { AnalyticsCtx, type AnalyticsGranularity, type AnalyticsData } from './components/AnalyticsContext';
import { toDate, toDateTimeInputValue } from './components/admin-shared';
import { OverviewSection } from './components/sections/OverviewSection';
import { PlansSection } from './components/sections/PlansSection';
import { TopupSection } from './components/sections/TopupSection';
import { UsersSection } from './components/sections/UsersSection';
import { SongsSection } from './components/sections/SongsSection';
import { CatalogSection } from './components/sections/CatalogSection';
import { GrowthSection } from './components/sections/GrowthSection';
import { RecSysSection } from './components/sections/RecSysSection';
import { PlatformConfigSection } from './components/sections/PlatformConfigSection';

const NAV = [
    { id: 'overview', label: 'Overview',        icon: LayoutDashboard },
    { id: 'plans',    label: 'Plans',           icon: CreditCard },
    { id: 'topup',    label: 'Top-up Packages', icon: Package },
    { id: 'users',    label: 'Users',           icon: Users },
    { id: 'songs',    label: 'Songs',           icon: Music2 },
    { id: 'catalog',  label: 'Catalog',         icon: Music2 },
    { id: 'growth',   label: 'Growth',          icon: TrendingUp },
    { id: 'recsys',   label: 'RecSys',          icon: BrainCircuit },
    { id: 'config',   label: 'Platform Config', icon: Zap },
] as const;

type Section = typeof NAV[number]['id'];

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
        <div className="flex items-center justify-center h-full" style={{ background: 'var(--ink-0)' }}>
            <Loader className="size-6 animate-spin text-[oklch(0.88_0.12_75)]" />
        </div>
    );

    if (!isAdmin) return (
        <div className="flex items-center justify-center h-full" style={{ background: 'var(--ink-0)', color: 'var(--fg-3)' }}>
            <div className="text-center">
                <p className="serif text-[28px] text-white italic">Access denied.</p>
                <p className="mt-2 text-[13px]" style={{ color: 'var(--fg-3)' }}>You don't have admin privileges.</p>
            </div>
        </div>
    );

    const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

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
            <div className="min-h-full" style={{ background: 'var(--ink-0)' }}>
                <div className="border-b hair sticky top-0 z-30 backdrop-blur-md" style={{ background: 'color-mix(in oklab, var(--ink-0) 88%, transparent)' }}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 lg:pt-10 pb-4 sm:pb-5 lg:pb-6 max-w-[1400px] mx-auto">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>Platform Control · v2.4</span>
                                <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.74_0.14_160_/_0.15)] text-[oklch(0.78_0.14_160)] ring-1 ring-[oklch(0.74_0.14_160_/_0.35)]">
                                    ● All systems operational
                                </span>
                            </div>
                            <h1 className="serif text-white mt-2 sm:mt-3 tracking-[-0.02em] leading-[1.02] text-[32px] sm:text-[44px] lg:text-[56px]">
                                The night in <em className="italic">numbers.</em>
                            </h1>
                            <p className="text-[13px] sm:text-[14px] mt-1.5 sm:mt-2" style={{ color: 'var(--fg-2)' }}>{todayStr} · Auto-refresh 30s</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select className="h-9 px-3 rounded-lg text-[12px] text-white outline-none ring-1 ring-white/10"
                                    style={{ background: 'var(--ink-2)' }}>
                                <option>Last 30 days</option>
                                <option>Last 7 days</option>
                                <option>Today</option>
                                <option>Custom range</option>
                            </select>
                            <button className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl ring-1 ring-white/15 text-[12px] hover:bg-white/5 press"
                                    style={{ color: 'var(--fg-1)' }}
                                    onClick={() => { setAnalyticsLoading(true); setAnalyticsRefreshTick(v => v + 1); }}>
                                <RefreshCw className="size-3.5" /> <span className="hidden sm:inline">Refresh</span>
                            </button>
                            <button className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">
                                <Zap className="size-3.5" /> <span className="hidden sm:inline">Live mode</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
                        <div className="flex gap-0.5 sm:gap-1 overflow-x-auto hide-scrollbar -mb-px">
                            {NAV.map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => setSection(id)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 text-[12px] sm:text-[13px] border-b-2 press transition-colors whitespace-nowrap shrink-0 min-h-[40px]',
                                        section === id
                                            ? 'text-white border-[oklch(0.88_0.12_75)]'
                                            : 'border-transparent hover:text-white',
                                    )}
                                    style={{ color: section === id ? 'white' : 'var(--fg-3)' }}>
                                    <Icon className="size-3.5 sm:size-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10">
                    <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8">
                        {section === 'overview' && <OverviewSection />}
                        {section === 'plans'    && <PlansSection />}
                        {section === 'topup'    && <TopupSection />}
                        {section === 'users'    && <UsersSection />}
                        {section === 'songs'    && <SongsSection />}
                        {section === 'catalog'  && <CatalogSection />}
                        {section === 'growth'   && <GrowthSection />}
                        {section === 'recsys'   && <RecSysSection />}
                        {section === 'config'   && <PlatformConfigSection />}
                    </div>
                </div>
            </div>
        </AnalyticsCtx.Provider>
    );
};
