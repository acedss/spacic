import { useState } from 'react';
import { Gem, Trophy, Zap, ChevronRight } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const QUICK_AMOUNTS = [100, 500, 1000, 2500]; // in coins

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
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [newGoalValue, setNewGoalValue] = useState('');

    if (!room || room.streamGoal <= 0) return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
            <Zap className="size-6 opacity-20 text-white" />
            <p className="text-[13px] text-white">No stream goal set</p>
            <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>The creator hasn't set a goal yet.</p>
        </div>
    );

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
        const newGoal = parseInt(newGoalValue, 10);
        if (!newGoal || newGoal <= room.streamGoalCurrent) {
            toast.error(`New goal must be above ${room.streamGoalCurrent.toLocaleString()} coins`);
            return;
        }
        onUpdateGoal(newGoal);
        setShowGoalModal(false);
        setNewGoalValue('');
    };

    return (
        <>
            <div className="p-5 flex flex-col gap-5 h-full overflow-auto hide-scrollbar">
                {/* Wallet balance card */}
                <div className="rounded-xl p-4 ring-1 ring-[oklch(0.82_0.15_75_/_0.3)]"
                     style={{ background: 'linear-gradient(145deg, oklch(0.22 0.05 75 / 0.5), oklch(0.14 0.03 60))' }}>
                    <div className="flex items-center justify-between">
                        <span className="mono text-[9px] uppercase tracking-widest text-[oklch(0.88_0.12_75)]">Wallet balance</span>
                        <Gem className="size-3.5 text-[oklch(0.88_0.12_75)]" />
                    </div>
                    <p className="mono text-[28px] text-white mt-2 tabular-nums leading-none">
                        {balance.toLocaleString()} <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>coins</span>
                    </p>
                </div>

                {/* Goal progress */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {goalReached ? <Trophy className="size-4 text-[oklch(0.88_0.12_75)]" /> : <Zap className="size-4 text-[oklch(0.88_0.12_75)]" />}
                            <span className="text-[13px] text-white font-medium">
                                {goalReached ? 'Goal Reached! 🎉' : 'Stream Goal'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="mono text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
                                {room.streamGoalCurrent.toLocaleString()} / {room.streamGoal.toLocaleString()}
                            </span>
                            {goalReached && isCreator && (
                                <button onClick={() => setShowGoalModal(true)}
                                    className="flex items-center gap-0.5 text-[11px] text-[oklch(0.68_0.21_295)] hover:text-white transition-colors">
                                    Raise <ChevronRight className="size-3" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full line-scan transition-all duration-500"
                             style={{ width: `${progress}%`, background: 'linear-gradient(90deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))' }} />
                    </div>
                    <span className="mono text-[10px] tabular-nums mt-1 block text-right text-[oklch(0.88_0.12_75)]">
                        {progress.toFixed(0)}%
                    </span>
                </div>

                {/* Quick donate amounts */}
                {!goalReached && (
                    <>
                        <div>
                            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>
                                Donate to creator
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_AMOUNTS.map((amount) => (
                                    <button key={amount}
                                        onClick={() => setSelected(amount === selected ? null : amount)}
                                        className={cn(
                                            'h-12 rounded-xl text-[13px] mono tabular-nums press ring-1 transition-all',
                                            selected === amount
                                                ? 'text-[oklch(0.18_0.02_80)] bg-[oklch(0.88_0.12_75)] ring-[oklch(0.88_0.12_75)]'
                                                : 'text-white bg-white/5 ring-white/10 hover:bg-white/10',
                                        )}>
                                        {amount.toLocaleString()} coins
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleDonate}
                            disabled={!selected || donating}
                            className={cn(
                                'w-full h-11 rounded-xl text-[13px] font-semibold press transition-all ring-1',
                                selected && !donating
                                    ? 'bg-[oklch(0.88_0.12_75)] text-[oklch(0.18_0.02_80)] ring-[oklch(0.88_0.12_75)]'
                                    : 'bg-white/5 text-white/30 ring-white/8 cursor-not-allowed',
                            )}>
                            <Gem className={cn('inline size-3.5 mr-1.5 -mt-0.5', donating && 'animate-pulse')} />
                            {donating ? 'Sending…' : selected ? `Donate ${selected.toLocaleString()} coins` : 'Select an amount'}
                        </button>
                    </>
                )}

                {goalReached && !isCreator && (
                    <p className="text-center text-[12px]" style={{ color: 'var(--fg-3)' }}>
                        The stream goal has been reached. Thank you for your support!
                    </p>
                )}
            </div>

            {/* Raise Goal Dialog (creator only) */}
            <Dialog open={showGoalModal} onOpenChange={(open) => { if (!open) { setShowGoalModal(false); setNewGoalValue(''); } }}>
                <DialogContent className="border-white/10 text-white max-w-sm" style={{ background: 'var(--ink-1)' }}>
                    <DialogHeader>
                        <DialogTitle className="serif text-[22px] text-white italic">Raise the goal.</DialogTitle>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--fg-3)' }}>
                            Current: {room.streamGoalCurrent.toLocaleString()} raised. New goal must be higher.
                        </p>
                    </DialogHeader>
                    <div className="space-y-2">
                        <input
                            type="number"
                            min={room.streamGoalCurrent + 1}
                            value={newGoalValue}
                            onChange={(e) => setNewGoalValue(e.target.value)}
                            placeholder={`More than ${room.streamGoalCurrent.toLocaleString()} coins`}
                            className="w-full h-10 px-3 rounded-xl bg-white/6 ring-1 ring-white/10 text-[13px] text-white placeholder:text-[var(--fg-3)] outline-none focus:ring-[oklch(0.68_0.21_295_/_0.5)]"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <button onClick={() => { setShowGoalModal(false); setNewGoalValue(''); }}
                            className="flex-1 h-10 rounded-xl ring-1 ring-white/12 text-[12px] hover:bg-white/5 press"
                            style={{ color: 'var(--fg-2)' }}>
                            Cancel
                        </button>
                        <button onClick={handleGoalSubmit}
                            className="flex-1 h-10 rounded-xl bg-[oklch(0.68_0.21_295)] text-white text-[12px] font-semibold press">
                            Raise Goal
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
