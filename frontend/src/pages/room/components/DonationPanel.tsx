import { useState } from 'react';
import { Heart, Zap } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [100, 500, 1000, 2500]; // in credits

const formatCredits = (credits: number) =>
    `$${(credits / 100).toFixed(2)}`;

interface DonationPanelProps {
    onDonate: (amount: number) => void;
}

export const DonationPanel = ({ onDonate }: DonationPanelProps) => {
    const { room } = useRoomStore();
    const { balance } = useWalletStore();
    const [selected, setSelected] = useState<number | null>(null);
    const [donating, setDonating] = useState(false);

    if (!room || room.streamGoal <= 0) return null;

    const progress = room.streamGoal > 0
        ? Math.min((room.streamGoalCurrent / room.streamGoal) * 100, 100)
        : 0;

    const handleDonate = async () => {
        if (!selected) return;
        if (balance < selected) {
            toast.error('Insufficient balance. Top up your wallet first.');
            return;
        }
        setDonating(true);
        onDonate(selected);
        // optimistic UI reset — server will broadcast real value
        setTimeout(() => {
            setDonating(false);
            setSelected(null);
        }, 800);
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            {/* Goal header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="size-4 text-yellow-400" />
                    <span className="text-sm font-medium">Stream Goal</span>
                </div>
                <span className="text-xs text-zinc-400">
                    {formatCredits(room.streamGoalCurrent)} / {formatCredits(room.streamGoal)}
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Quick donate buttons */}
            <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                    <button
                        key={amount}
                        onClick={() => setSelected(amount === selected ? null : amount)}
                        className={cn(
                            'text-xs py-1.5 rounded-lg border transition-colors',
                            selected === amount
                                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                        )}
                    >
                        {formatCredits(amount)}
                    </button>
                ))}
            </div>

            {/* Confirm donate button */}
            <button
                onClick={handleDonate}
                disabled={!selected || donating}
                className={cn(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                    selected && !donating
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                        : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                )}
            >
                <Heart className={cn('size-4', donating && 'animate-pulse')} />
                {donating ? 'Sending...' : selected ? `Donate ${formatCredits(selected)}` : 'Select an amount'}
            </button>

            {/* Balance hint */}
            <p className="text-center text-xs text-zinc-600">
                Your balance: {formatCredits(balance)}
            </p>
        </div>
    );
};
