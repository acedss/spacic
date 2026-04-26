import { Link } from 'react-router-dom';
import { Crown, ChevronRight } from 'lucide-react';

export const UpgradeBanner = () => (
    <Link
        to="/subscription"
        className="flex items-center gap-4 p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5
                   hover:bg-purple-500/10 hover:border-purple-500/40 transition-all group"
    >
        <div className="bg-purple-500/15 rounded-xl p-2.5 flex-shrink-0">
            <Crown className="size-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Unlock Premium or Creator</p>
            <p className="text-xs text-zinc-500 mt-0.5">Host bigger rooms, HD audio &amp; stream goals</p>
        </div>
        <ChevronRight className="size-4 text-zinc-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
    </Link>
);
