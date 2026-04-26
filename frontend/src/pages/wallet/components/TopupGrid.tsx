import { TrendingUp } from 'lucide-react';
import type { TopupPackage } from '@/types/types';
import { PackageCard } from './PackageCard';

interface Props {
    packages: TopupPackage[];
    loading: boolean;
    topupLoading: boolean;
    onSelect: (id: string) => void;
}

export const TopupGrid = ({ packages, loading, topupLoading, onSelect }: Props) => (
    <div>
        <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="size-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Add Coins</h2>
        </div>

        {packages.length === 0 && !loading ? (
            <p className="text-zinc-600 text-sm">No packages available.</p>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                {packages.map(pkg => (
                    <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        onSelect={() => onSelect(pkg.id)}
                        loading={topupLoading}
                    />
                ))}
            </div>
        )}

        <p className="text-xs text-zinc-600 mt-4">
            Payments processed securely by Stripe. Coins are non-refundable.
        </p>
    </div>
);
