import { useState } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';
import { UserPublicProfileModal } from './UserPublicProfileModal';

// Tier gates — each crossed gate = +1 tier (unlimited)
const GATES = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];

function getTier(amount: number): number {
    return GATES.filter(g => amount >= g).length;
}

// Size grows 8px per tier, starting at 20px
function getSize(tier: number): number {
    return 20 + tier * 8;
}

// Shake amplitude: none at tier 0, grows per tier
function getAmplitude(tier: number): string {
    if (tier === 0) return '0px';
    return `${1.2 + (tier - 1) * 1.4}px`;
}

// Shake speed: slows as it gets more intense
function getDuration(tier: number): string {
    if (tier === 0) return '0s';
    const ms = Math.max(160, 480 - tier * 35);
    return `${ms}ms`;
}

interface SelectedUser {
    userId: string;
    userName: string;
    imageUrl: string;
}

export const TipRainOverlay = () => {
    const tipRainSessions = useRoomStore((s) => s.tipRainSessions);
    const [selected, setSelected] = useState<SelectedUser | null>(null);
    const sessions = Object.values(tipRainSessions);

    return (
        <>
            <style>{`
                @keyframes tip-shake {
                    0%,100% { transform: translate(0, 0) rotate(0deg) }
                    15%     { transform: translate(var(--sa), calc(var(--sa) * -.5)) rotate(.8deg) }
                    35%     { transform: translate(calc(var(--sa) * -.8), calc(var(--sa) * .3)) rotate(-.6deg) }
                    55%     { transform: translate(calc(var(--sa) * .6), var(--sa)) rotate(.4deg) }
                    75%     { transform: translate(calc(var(--sa) * -.4), calc(var(--sa) * -.7)) rotate(-.4deg) }
                }
                @keyframes tip-ring-pulse {
                    0%   { transform: scale(1);   opacity: .55 }
                    100% { transform: scale(2.2); opacity: 0 }
                }
                @keyframes tip-appear {
                    from { opacity: 0; transform: scale(0.5) }
                    to   { opacity: 1; transform: scale(1) }
                }
            `}</style>

            {/* pointer-events-none on the overlay, auto on each avatar */}
            <div className="fixed inset-0 pointer-events-none z-30">
                {sessions.map((s) => {
                    const t    = getTier(s.amount);
                    const size = getSize(t);
                    const sa   = getAmplitude(t);
                    const dur  = getDuration(t);
                    const shaking = t > 0;

                    return (
                        <div
                            key={s.userId}
                            className="absolute pointer-events-auto cursor-pointer"
                            style={{
                                left: `${s.x}%`,
                                top:  `${s.y}%`,
                                animation: 'tip-appear 0.3s ease-out both',
                            }}
                            onClick={() => setSelected({ userId: s.userId, userName: s.userName, imageUrl: s.imageUrl })}>

                            {/* Expanding pulse ring */}
                            {shaking && (
                                <span className="absolute inset-0 rounded-full"
                                    style={{
                                        width: size, height: size,
                                        background: 'oklch(0.88 0.12 75 / 0.3)',
                                        animation: `tip-ring-pulse ${dur} ease-out infinite`,
                                    }} />
                            )}

                            {/* Avatar */}
                            <div
                                className="rounded-full ring-2 overflow-hidden transition-all duration-300"
                                style={{
                                    width:     size,
                                    height:    size,
                                    ringColor: 'oklch(0.88 0.12 75)',
                                    boxShadow: `0 0 ${6 + t * 5}px oklch(0.88 0.12 75 / ${Math.min(0.25 + t * 0.08, 0.8)})`,
                                    '--sa': sa,
                                    animation: shaking
                                        ? `tip-shake ${dur} ease-in-out infinite`
                                        : 'none',
                                } as React.CSSProperties}>
                                {s.imageUrl
                                    ? <img src={s.imageUrl} alt={s.userName} className="w-full h-full object-cover" />
                                    : (
                                        <div className="w-full h-full flex items-center justify-center bg-[oklch(0.3_0.08_295)] text-white font-bold"
                                            style={{ fontSize: size * 0.38 }}>
                                            {s.userName[0]?.toUpperCase()}
                                        </div>
                                    )
                                }
                            </div>

                            {/* Coin badge */}
                            <span
                                className="absolute -bottom-1 -right-1 mono font-bold leading-none px-1 rounded-full ring-1 ring-[oklch(0.14_0.02_80)]"
                                style={{
                                    background: 'oklch(0.88 0.12 75)',
                                    color:      'oklch(0.14 0.02 80)',
                                    fontSize:   Math.max(7, 7 + t * 0.8),
                                    paddingTop:    2,
                                    paddingBottom: 2,
                                }}>
                                {s.amount >= 1000 ? `${(s.amount / 1000).toFixed(1)}k` : s.amount}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Profile sheet */}
            <UserPublicProfileModal
                userId={selected?.userId ?? null}
                userName={selected?.userName ?? ''}
                imageUrl={selected?.imageUrl ?? ''}
                onClose={() => setSelected(null)}
            />
        </>
    );
};
