import { Clock, Gem, Loader2, Radio, Users } from 'lucide-react';
import { StatBadge } from './StatBadge';
import { fmtDuration, type LiveStats } from './live-shared';

interface Props {
    title: string;
    connected: boolean;
    stats: LiveStats;
    sessionDuration: number;
    toggling: boolean;
    onGoOffline: () => void;
}

export const LiveTopBar = ({ title, connected, stats, sessionDuration, toggling, onGoOffline }: Props) => (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm px-5 py-3 flex items-center gap-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5 flex-shrink-0">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
            <p className="font-semibold text-white truncate text-sm">{title}</p>
            {!connected && <span className="text-xs text-zinc-500 flex-shrink-0">Connecting…</span>}
        </div>

        <div className="hidden md:flex items-center gap-2">
            <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
            <StatBadge icon={Gem} value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
            <StatBadge icon={Clock} value={fmtDuration(sessionDuration)} label="live time" color="text-indigo-400" />
        </div>

        <button
            onClick={onGoOffline}
            disabled={toggling}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors flex-shrink-0"
        >
            {toggling ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
            Go Offline
        </button>
    </div>
);
