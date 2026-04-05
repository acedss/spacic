import { useState } from 'react';
import { Heart, Zap, Trophy, ChevronRight } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [100, 500, 1000, 2500]; // in credits

const toCoins = (credits: number) => `${credits.toLocaleString()} coins`;

interface DonationPanelProps {
    onDonate: (amount: number) => void;
    onUpdateGoal: (newGoal: number) => void;
    isCreator: boolean;
}

export const DonationPanel = ({ onDonate, onUpdateGoal, isCreator }: DonationPanelProps) => {
    const { room } = useRoomStore();
    const { balance } = useWalletStore();
    const [selected, setSelected] = useState<number | null>(null);
    const [donating, setDonating] = useState(false);

    // Goal increase modal state (creator only)
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [newGoalDollars, setNewGoalDollars] = useState('');

    if (!room || room.streamGoal <= 0) return null;

    const goalReached = room.streamGoalCurrent >= room.streamGoal;
    const progress = Math.min((room.streamGoalCurrent / room.streamGoal) * 100, 100);

    const handleDonate = () => {
        if (!selected) return;
        if (balance < selected) {
            toast.error('Insufficient balance. Top up your wallet first.');
            return;
        }
        setDonating(true);
        onDonate(selected);
        setTimeout(() => { setDonating(false); setSelected(null); }, 800);
    };

    const handleGoalSubmit = () => {
        const newGoal = parseInt(newGoalDollars, 10);
        if (!newGoal || newGoal <= room.streamGoalCurrent) {
            toast.error(`New goal must be above ${room.streamGoalCurrent.toLocaleString()} coins`);
            return;
        }
        onUpdateGoal(newGoal);
        setShowGoalModal(false);
        setNewGoalDollars('');
    };

    return (
        <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                {/* Goal header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {goalReached
                            ? <Trophy className="size-4 text-yellow-400" />
                            : <Zap className="size-4 text-yellow-400" />
                        }
                        <span className="text-sm font-medium">
                            {goalReached ? 'Goal Reached! 🎉' : 'Stream Goal'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">
                            {toCoins(room.streamGoalCurrent)} / {toCoins(room.streamGoal)}
                        </span>
                        {/* Creator: raise goal after it's been reached */}
                        {goalReached && isCreator && (
                            <button
                                onClick={() => setShowGoalModal(true)}
                                className="flex items-center gap-0.5 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                            >
                                Raise <ChevronRight className="size-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all duration-700',
                            goalReached
                                ? 'bg-gradient-to-r from-yellow-400 to-yellow-300'
                                : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Quick donate buttons — hidden when goal reached */}
                {!goalReached && (
                    <>
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
                                    {toCoins(amount)}
                                </button>
                            ))}
                        </div>

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
                            {donating ? 'Sending...' : selected ? `Donate ${toCoins(selected)}` : 'Select an amount'}
                        </button>

                        <p className="text-center text-xs text-zinc-600">
                            Your balance: {toCoins(balance)}
                        </p>
                    </>
                )}

                {/* Goal reached state for non-creators */}
                {goalReached && !isCreator && (
                    <p className="text-center text-xs text-zinc-500">
                        The stream goal has been reached. Thank you for your support!
                    </p>
                )}
            </div>

            {/* ── Increase Goal Modal (creator only) ─────────────────────────── */}
            {showGoalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Raise Stream Goal</h3>
                            <p className="text-xs text-zinc-500 mt-1">
                                Current: {toCoins(room.streamGoalCurrent)} raised. New goal must be higher.
                            </p>
                        </div>

                        <div className="relative">
                            <input
                                type="number"
                                min={room.streamGoalCurrent + 1}
                                step="1"
                                autoFocus
                                value={newGoalDollars}
                                onChange={(e) => setNewGoalDollars(e.target.value)}
                                placeholder={`More than ${room.streamGoalCurrent.toLocaleString()} coins`}
                                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowGoalModal(false); setNewGoalDollars(''); }}
                                className="flex-1 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGoalSubmit}
                                className="flex-1 py-2.5 rounded-xl text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                            >
                                Raise Goal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
