import { Coins, Gamepad2, Mic } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { ActiveGame, BroadcastAsset, Minigame } from '@/types/types';
import { BroadcastPanel } from './BroadcastPanel';
import { MinigamePanel } from './MinigamePanel';
import { StreamGoalPanel } from './StreamGoalPanel';
import { DonationFeed } from './DonationFeed';
import type { RightTab } from './live-shared';

interface Props {
    tab: RightTab;
    setTab: (t: RightTab) => void;
    socket: Socket | null;
    connected: boolean;
    roomId: string;
    streamGoal: number;
    coinsThisSession: number;
    onGoalChanged: (goal: number) => void;
    creatorBalance: number;
    minigames: Minigame[];
    activeGame: ActiveGame | null;
    gameSecondsLeft: number;
    onTriggerGame: (id: string) => void;
    onGameAdded: (g: Minigame) => void;
    broadcastAssets: BroadcastAsset[];
}

export const LiveControlsColumn = ({
    tab, setTab, socket, connected, roomId, streamGoal, coinsThisSession, onGoalChanged,
    creatorBalance, minigames, activeGame, gameSecondsLeft, onTriggerGame, onGameAdded,
    broadcastAssets,
}: Props) => (
    <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-white/10 flex-shrink-0">
            {([
                { id: 'broadcast' as const, icon: Mic, label: 'Broadcast' },
                { id: 'games' as const, icon: Gamepad2, label: 'Games' },
                { id: 'goal' as const, icon: Coins, label: 'Goal & Tips' },
            ]).map(({ id, icon: Icon, label }) => (
                <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${tab === id
                        ? 'text-white border-violet-500 bg-white/5'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <Icon className="size-3.5" />
                    {label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
            {tab === 'broadcast' && (
                <BroadcastPanel
                    socket={socket}
                    roomId={roomId}
                    assets={broadcastAssets}
                    connected={connected}
                />
            )}
            {tab === 'games' && (
                <MinigamePanel
                    roomId={roomId}
                    creatorBalance={creatorBalance}
                    minigames={minigames}
                    activeGame={activeGame}
                    gameSecondsLeft={gameSecondsLeft}
                    onTrigger={onTriggerGame}
                    onGameAdded={onGameAdded}
                />
            )}
            {tab === 'goal' && (
                <div className="space-y-5">
                    <StreamGoalPanel
                        roomId={roomId}
                        streamGoal={streamGoal}
                        streamGoalCurrent={coinsThisSession}
                        onGoalChanged={onGoalChanged}
                    />
                    <DonationFeed socket={socket} />
                </div>
            )}
        </div>
    </div>
);
