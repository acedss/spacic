import { UserButton } from "@clerk/clerk-react";
import { ChevronLeft, ChevronRight, Search, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "@/stores/useWalletStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { useSocialSocket } from "@/providers/SocialSocketProvider";
import { axiosInstance } from "@/lib/axios";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RoomState = 'none' | 'offline' | 'live'

interface TopBarProps {
    onSearchOpen: () => void
}

const TopBar = ({ onSearchOpen }: TopBarProps) => {
    const navigate = useNavigate();
    const { balance } = useWalletStore();
    const socket = useSocialSocket();
    const storeListenerCount = useRoomStore(s => s.listenerCount);
    const isCreator = useRoomStore(s => s.isCreator);
    const [roomState, setRoomState] = useState<RoomState>('none');
    const [listenerCount, setListenerCount] = useState(0);
    const effectiveListenerCount = (roomState === 'live' && isCreator && storeListenerCount > 0)
        ? storeListenerCount
        : listenerCount;
    const fetched = useRef(false);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        axiosInstance.get('/rooms/me/room')
            .then(({ data }) => {
                const room = data.data;
                if (!room) return;
                setRoomState(room.status === 'live' ? 'live' : 'offline');
                if (room.status === 'live') setListenerCount(room.listenerCount ?? 0);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!socket) return;
        const onLive = () => { setRoomState('live'); setListenerCount(0); };
        const onOffline = () => { setRoomState('offline'); setListenerCount(0); };
        socket.on('creator:room_live', onLive);
        socket.on('creator:room_offline', onOffline);
        return () => {
            socket.off('creator:room_live', onLive);
            socket.off('creator:room_offline', onOffline);
        };
    }, [socket]);

    const handleGoLive = () => navigate(roomState === 'live' ? '/studio/live' : '/studio');

    return (
        <div className="flex items-center gap-3 px-4 h-11 border-b hair shrink-0 glass z-30"
            style={{ background: 'oklch(0.1 0.015 285 / 0.85)', backdropFilter: 'blur(16px)' }}>

            {/* Spacer for left sidebar (w-16) */}
            <div className="w-16 shrink-0" />

            {/* Back / Forward */}
            <div className="flex items-center gap-0.5">
                <button onClick={() => navigate(-1)} className="h-7 w-7 rounded-lg grid place-items-center press hover:bg-white/8" style={{ color: 'var(--fg-3)' }}>
                    <ChevronLeft className="size-4" />
                </button>
                <button onClick={() => navigate(1)} className="h-7 w-7 rounded-lg grid place-items-center press hover:bg-white/8" style={{ color: 'var(--fg-3)' }}>
                    <ChevronRight className="size-4" />
                </button>
            </div>

            {/* Search trigger — centered */}
            <button
                onClick={onSearchOpen}
                className="flex-1 max-w-sm mx-auto flex items-center gap-2.5 h-8 px-3 rounded-xl ring-1 ring-white/10 text-left press transition-colors hover:bg-white/8"
                style={{ background: 'oklch(1 0 0 / 0.05)', color: 'var(--fg-3)' }}>
                <Search className="size-3.5 shrink-0" />
                <span className="flex-1 text-[12px] truncate">Search rooms, creators, songs…</span>
                <kbd className="mono text-[9px] px-1.5 py-0.5 rounded ring-1 ring-white/12 shrink-0" style={{ background: 'oklch(1 0 0 / 0.06)' }}>⌘K</kbd>
            </button>

            {/* Right actions */}
            <div className="flex items-center gap-2 ml-auto">
                {/* Go Live CTA */}
                <button
                    onClick={handleGoLive}
                    className={cn(
                        'flex items-center gap-1.5 h-7 px-3 rounded-xl text-[12px] font-semibold press transition-all',
                        roomState === 'live'
                            ? 'bg-[oklch(0.72_0.22_20/0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20/0.4)]'
                            : 'bg-white/8 text-white ring-1 ring-white/10 hover:bg-white/12'
                    )}>
                    {roomState === 'live'
                        ? <span className="live-dot" />
                        : <Zap className="size-3.5" />}
                    <span>{roomState === 'live'
                        ? `Live${effectiveListenerCount > 0 ? ` · ${effectiveListenerCount}` : ''}`
                        : 'Go Live'}</span>
                </button>

                {/* Wallet balance */}
                {balance > 0 && (
                    <button
                        onClick={() => navigate('/wallet')}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-xl bg-white/5 ring-1 ring-white/10 press hover:bg-white/8 transition-colors">
                        <span className="text-[13px] leading-none">💎</span>
                        <span className="mono text-[11px] font-semibold text-white tabular-nums">{balance.toLocaleString()}</span>
                    </button>
                )}

                <UserButton userProfileUrl="/profile" />
            </div>
        </div>
    );
};

export default TopBar;
