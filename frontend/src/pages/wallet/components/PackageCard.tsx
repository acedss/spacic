import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import type { TopupPackage } from '@/types/types'

export const PackageCard = ({ pkg, onSelect, loading }: {
    pkg: TopupPackage;
    onSelect: () => void;
    loading: boolean;
}) => (
    <button
        onClick={onSelect}
        disabled={loading}
        className={cn(
            'relative flex flex-col gap-3 p-5 rounded-2xl border transition-all text-left group',
            'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5',
            loading && 'opacity-50 cursor-not-allowed',
            pkg.isFeatured && 'border-purple-500/40 bg-purple-500/5',
        )}
    >
        {pkg.isFeatured && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="flex items-center gap-1 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg shadow-purple-500/30">
                    <Sparkles className="size-2.5" />
                    Most Popular
                </span>
            </div>
        )}

        {pkg.bonus && !pkg.isFeatured && (
            <span className="absolute top-3 right-3 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                {pkg.bonus}
            </span>
        )}

        {pkg.isFeatured && pkg.bonus && (
            <span className="absolute top-3 right-3 bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                {pkg.bonus}
            </span>
        )}

        <span className="text-2xl font-bold text-white mt-1">
            ${(pkg.priceInCents / 100).toFixed(2)}
        </span>
        <div>
            <p className="text-sm font-medium text-white/80">{pkg.credits.toLocaleString()} coins</p>
            <p className="text-xs text-zinc-500 mt-0.5">{pkg.label}</p>
        </div>
    </button>
)
