import { Gem, MessageSquare, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatPanel } from './ChatPanel';
import { DonationPanel } from './DonationPanel';
import { GoalPanel } from './GoalPanel';

export type RightTab = 'chat' | 'tip' | 'goal';

interface Props {
    tab: RightTab;
    setTab: (t: RightTab) => void;
    onSendChat: (msg: string) => void;
    onDonate: (amount: number, message?: string) => void;
    onUpdateGoal: (goal: number, description?: string) => void;
    isCreator: boolean;
    onPinMessage: (messageId: string, message: string, userId: string, userName: string) => void;
}

export const RightRail = ({ tab, setTab, onSendChat, onDonate, onUpdateGoal, isCreator, onPinMessage }: Props) => (
    <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden flex flex-col h-full" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
        <div className="flex border-b hair flex-shrink-0">
            {([
                { id: 'chat' as RightTab, label: 'Chat', icon: MessageSquare },
                { id: 'tip' as RightTab, label: 'Tip', icon: Gem },
                { id: 'goal' as RightTab, label: 'Goal', icon: Music2 },
            ] as const).map(({ id, label, icon: Icon }) => {
                const on = tab === id;
                return (
                    <button key={id} onClick={() => setTab(id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] border-b-2 -mb-px press transition-colors',
                            on ? 'text-white border-[oklch(0.82_0.15_75)]' : 'border-transparent hover:text-[var(--fg-1)]',
                        )}
                        style={{ color: on ? 'white' : 'var(--fg-3)' }}>
                        <Icon className="size-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
            {tab === 'chat' && <ChatPanel onSendMessage={onSendChat} onPinMessage={onPinMessage} isCreator={isCreator} />}
            {tab === 'tip' && <DonationPanel onDonate={onDonate} onUpdateGoal={onUpdateGoal} isCreator={isCreator} />}
            {tab === 'goal' && <GoalPanel />}
        </div>
    </div>
);
