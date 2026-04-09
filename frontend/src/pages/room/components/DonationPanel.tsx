import { useState } from 'react';
import { Heart, Zap, Trophy, ChevronRight } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
                <Progress
                    value={progress}
                    className={cn(
                        'h-2 bg-white/10',
                        goalReached ? '[&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-yellow-300'
                                    : '[&>div]:bg-gradient-to-r [&>div]:from-yellow-500 [&>div]:to-orange-500'
                    )}
                />

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

                        <Button
                            onClick={handleDonate}
                            disabled={!selected || donating}
                            className={cn(
                                'w-full text-sm font-medium',
                                selected && !donating
                                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                    : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                            )}
                        >
                            <Heart className={cn('size-4', donating && 'animate-pulse')} />
                            {donating ? 'Sending...' : selected ? `Donate ${toCoins(selected)}` : 'Select an amount'}
                        </Button>

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

            {/* ── Increase Goal Dialog (creator only) ────────────────────────── */}
            <Dialog open={showGoalModal} onOpenChange={(open) => { if (!open) { setShowGoalModal(false); setNewGoalDollars(''); } }}>
                <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Raise Stream Goal</DialogTitle>
                        <p className="text-xs text-zinc-500 mt-1">
                            Current: {toCoins(room.streamGoalCurrent)} raised. New goal must be higher.
                        </p>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="new-goal" className="text-zinc-400">New goal (coins)</Label>
                        <Input
                            id="new-goal"
                            type="number"
                            min={room.streamGoalCurrent + 1}
                            step="1"
                            autoFocus
                            value={newGoalDollars}
                            onChange={(e) => setNewGoalDollars(e.target.value)}
                            placeholder={`More than ${room.streamGoalCurrent.toLocaleString()} coins`}
                            className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
                        />
                    </div>

                    <DialogFooter className="gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => { setShowGoalModal(false); setNewGoalDollars(''); }}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleGoalSubmit}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white"
                        >
                            Raise Goal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
