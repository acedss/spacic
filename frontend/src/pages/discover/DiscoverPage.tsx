import { Sparkles, TrendingUp, RefreshCw } from 'lucide-react';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { RecRoom } from '@/lib/recsService';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { RecRoomCard } from './components/RecRoomCard';
import { TrendingSongCard } from './components/TrendingSongCard';
import { SkeletonRow } from './components/SkeletonRow';
import { SOURCE_META } from './components/discover-shared';

const DiscoverPage = () => {
    const { forYou, trending, source, isLoading, error, refresh } = useRecommendations();
    const sourceBadge = source ? (SOURCE_META[source] ?? SOURCE_META.fallback) : null;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="serif italic text-[26px] text-white leading-tight">Discover</h1>
                    <p className="text-sm text-(--fg-3) mt-0.5">Rooms picked for you, updated nightly</p>
                </div>
                <button
                    onClick={refresh}
                    disabled={isLoading}
                    className={cn(
                        'flex items-center gap-1.5 text-xs text-(--fg-3) hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 press transition-all',
                        isLoading && 'opacity-50 pointer-events-none'
                    )}
                >
                    <RefreshCw className={cn('size-3', isLoading && 'animate-spin')} />
                    Refresh
                </button>
            </div>

            {error && <div className="text-center py-8 text-zinc-500 text-sm">{error}</div>}

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-violet-400" />
                    <span className="text-xs text-(--fg-2) uppercase tracking-wider font-semibold">Rooms For You</span>
                    {sourceBadge && !isLoading && (
                        <span className={cn('mono text-[10px] px-2 py-0.5 rounded-full ring-1', sourceBadge.color)}>
                            {sourceBadge.label}
                        </span>
                    )}
                </div>

                <div className="space-y-1.5">
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                        : forYou.length > 0
                            ? (forYou as RecRoom[]).map((r, i) => <RecRoomCard key={r._id} room={r} rank={i + 1} />)
                            : !error && (
                                <EmptyState
                                    icon={Sparkles}
                                    tone="violet"
                                    title="No room recommendations yet"
                                    description="Join a few rooms today — we'll learn your taste and have rooms ready by tomorrow."
                                />
                            )
                    }
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <TrendingUp className="size-3.5 text-amber-400" />
                    <span className="text-xs text-(--fg-2) uppercase tracking-wider font-semibold">Trending Songs Today</span>
                </div>

                <div className="space-y-1.5">
                    {isLoading
                        ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                        : trending.length > 0
                            ? trending.map((s, i) => <TrendingSongCard key={s._id} song={s} rank={i + 1} />)
                            : !error && (
                                <EmptyState
                                    icon={TrendingUp}
                                    tone="amber"
                                    title="No trending data yet today"
                                    description="Songs surge here as listeners stream them — check back in a bit."
                                />
                            )
                    }
                </div>
            </section>
        </div>
    );
};

export default DiscoverPage;
