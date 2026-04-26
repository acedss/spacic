import { Loader2, Radio, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RoomInfo } from '@/types/types';

interface Props {
    room: RoomInfo | null;
    toggling: boolean;
    canGoLive: boolean;
    onGoLive: () => void;
    onGoOffline: () => void;
}

export const StudioHeader = ({ room, toggling, canGoLive, onGoLive, onGoOffline }: Props) => {
    const navigate = useNavigate();
    const isLive = room?.status === 'live';
    const hasRoom = !!room;

    return (
        <div className="flex items-start justify-between">
            <div>
                <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Creator Studio</p>
                <h1 className="serif italic text-white" style={{ fontSize: 34 }}>
                    {hasRoom ? room.title : 'My Channel'}
                </h1>
                {hasRoom && room.status && (
                    <div className="flex items-center gap-2 mt-1.5">
                        {isLive
                            ? <><span className="live-dot" style={{ width: 6, height: 6 }} /><span className="mono text-[10px] text-[oklch(0.82_0.17_20)]">Live now · {room.listenerCount ?? 0} listening</span></>
                            : <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Offline</span>
                        }
                    </div>
                )}
            </div>

            {hasRoom && (
                <div className="flex items-center gap-2">
                    {isLive ? (
                        <>
                            <button onClick={() => navigate('/studio/live')}
                                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-semibold text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.12)] press">
                                <span className="live-dot" /> Live Dashboard
                            </button>
                            <button onClick={onGoOffline} disabled={toggling}
                                className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 disabled:opacity-50 press">
                                {toggling ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                                Go Offline
                            </button>
                        </>
                    ) : (
                        <button onClick={onGoLive} disabled={toggling || !canGoLive}
                            className="flex items-center gap-2 h-9 px-5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 press"
                            style={{ background: 'oklch(0.72 0.22 20)' }}>
                            {toggling ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                            Go Live
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
