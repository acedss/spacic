import { Check, Link2, LogOut } from 'lucide-react';
import type { RoomInfo } from '@/types/types';
import { SessionTimer } from './SessionTimer';
import { RoomInfoModal } from './RoomInfoModal';

interface Props {
    room: RoomInfo | null;
    isSignedIn: boolean | undefined;
    copied: boolean;
    onCopyLink: () => void;
    onLeave: () => void;
    onJoinAsGuest: () => void;
}

export const RoomHeader = ({ room, isSignedIn, copied, onCopyLink, onLeave, onJoinAsGuest }: Props) => (
    <div className="flex items-center justify-between px-8 h-16 border-b hair flex-shrink-0 glass">
        <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                Live
            </span>
            {room && (
                <>
                    <div className="h-4 w-px bg-white/15" />
                    <span className="text-[12px]" style={{ color: 'var(--fg-2)' }}>
                        in <span className="serif italic text-[16px] text-white">{room.title}</span>
                    </span>
                </>
            )}
        </div>
        <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Synced · 38ms</span>
            <SessionTimer />
            <button onClick={onCopyLink}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] ring-1 ring-white/15 hover:bg-white/8 press transition-colors"
                style={{ color: 'var(--fg-2)' }}>
                {copied ? <Check className="size-3.5 text-[oklch(0.74_0.14_160)]" /> : <Link2 className="size-3.5" />}
                {copied ? 'Copied!' : 'Share'}
            </button>
            {room && <RoomInfoModal room={room} />}
            {isSignedIn ? (
                <button onClick={onLeave}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)] bg-[oklch(0.72_0.22_20_/_0.1)] text-[oklch(0.82_0.17_20)] press hover:bg-[oklch(0.72_0.22_20_/_0.2)]">
                    <LogOut className="size-3.5" /> Leave room
                </button>
            ) : (
                <button onClick={onJoinAsGuest}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] bg-white text-[var(--ink-0)] font-semibold press">
                    Join to listen
                </button>
            )}
        </div>
    </div>
);
