import { useMemo } from 'react';
import { Mic, TrendingUp, Users } from 'lucide-react';
import { OrbitingCircles } from '@/components/ui/orbiting-circles';
import { ListenerAvatarStack } from '@/components/ui/avatar-circles';
import type { RoomInfo } from '@/types/types';

interface Props {
    room: RoomInfo;
    listenerCount: number;
    listenerHistory: number[];
}

export const Constellation = ({ room, listenerCount, listenerHistory }: Props) => {
    const creator = (room as any).creatorId as { fullName?: string; imageUrl?: string } | undefined;

    const MAX_ORBIT = 12;
    const { inner, outer, orbitOverflow } = useMemo(() => {
        const capped = Math.min(MAX_ORBIT, Math.max(2, listenerCount || 4));
        const innerCount = Math.min(4, Math.ceil(capped / 2));
        const outerCount = Math.min(8, capped - innerCount);
        const mkNodes = (count: number, offset: number) =>
            Array.from({ length: count }, (_, i) => ({ i: i + offset, hue: ((i + offset) * 37) % 360 }));
        return {
            inner: mkNodes(innerCount, 0),
            outer: mkNodes(outerCount, innerCount),
            orbitOverflow: Math.max(0, listenerCount - MAX_ORBIT),
        };
    }, [listenerCount]);

    return (
        <div className="rounded-2xl ring-1 ring-white/10 p-4 glass relative overflow-hidden ">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="mono text-[9px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>Listening together</div>
                    <p className="text-[12px] text-white mt-0.5">
                        {listenerCount.toLocaleString()} {listenerCount === 1 ? 'person' : 'people'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {listenerHistory.length > 1 && (
                        <div className="flex items-center gap-1">
                            <TrendingUp className="size-3 text-[oklch(0.88_0.12_75)] opacity-60" />
                            <svg width="52" height="20" viewBox="0 0 52 20" style={{ overflow: 'visible' }}>
                                {(() => {
                                    const max = Math.max(...listenerHistory, 1);
                                    const pts = listenerHistory.map((v, i) => {
                                        const x = listenerHistory.length === 1 ? 26 : (i / (listenerHistory.length - 1)) * 52;
                                        const y = 20 - Math.max(2, (v / max) * 18);
                                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ');
                                    const last = listenerHistory[listenerHistory.length - 1];
                                    const lastY = 20 - Math.max(2, (last / max) * 18);
                                    return (
                                        <>
                                            <polyline points={pts} fill="none"
                                                stroke="oklch(0.88 0.12 75 / 0.5)" strokeWidth="1.5"
                                                strokeLinecap="round" strokeLinejoin="round" />
                                            <circle cx={52} cy={lastY} r="2" fill="oklch(0.88 0.12 75)" />
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>
                    )}
                    <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] ring-1 ring-white/10 hover:bg-white/8 transition-colors" style={{ color: 'var(--fg-2)' }}>
                        <Users className="size-3" /> All
                    </button>
                </div>
            </div>

            <div className="relative flex items-center justify-center h-48 rounded-xl overflow-hidden"
                style={{ background: 'radial-gradient(ellipse at center, oklch(0.22 0.06 295 / 0.5), oklch(0.12 0.02 285) 75%)' }}>

                <OrbitingCircles radius={55} duration={22} iconSize={26} path>
                    {inner.map(n => (
                        <div key={n.i} className="rounded-full size-full ring-2 ring-white/25"
                            style={{ background: `oklch(0.55 0.16 ${n.hue})`, boxShadow: `0 0 8px oklch(0.55 0.16 ${n.hue} / 0.7)` }} />
                    ))}
                </OrbitingCircles>

                {outer.length > 0 && (
                    <OrbitingCircles radius={85} duration={38} iconSize={22} path reverse>
                        {outer.map(n => (
                            <div key={n.i} className="rounded-full size-full ring-1 ring-white/20"
                                style={{ background: `oklch(0.5 0.14 ${n.hue})`, boxShadow: `0 0 6px oklch(0.5 0.14 ${n.hue} / 0.5)` }} />
                        ))}
                    </OrbitingCircles>
                )}

                <div className="z-10 flex flex-col items-center">
                    <div className="relative">
                        {creator?.imageUrl ? (
                            <img src={creator.imageUrl}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-[oklch(0.88_0.12_75)]"
                                style={{ boxShadow: '0 0 24px oklch(0.88 0.12 75 / 0.6)' }}
                                alt="" />
                        ) : (
                            <div className="w-12 h-12 rounded-full ring-2 ring-[oklch(0.88_0.12_75)]"
                                style={{ background: 'oklch(0.3 0.08 295)', boxShadow: '0 0 24px oklch(0.88 0.12 75 / 0.6)' }} />
                        )}
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[7px] mono uppercase bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)] font-semibold tracking-wider whitespace-nowrap">Host</span>
                    </div>
                </div>
            </div>

            {orbitOverflow > 0 && (
                <div className="mt-3 flex items-center gap-2.5">
                    <ListenerAvatarStack count={listenerCount} maxVisible={5} size={24} />
                    <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>
                        +{orbitOverflow.toLocaleString()} more listening
                    </span>
                </div>
            )}

            <div className={orbitOverflow > 0 ? 'mt-2 flex items-center gap-2' : 'mt-3 flex items-center gap-2'}>
                <Mic className="size-3 text-[oklch(0.72_0.22_20)]" />
                <span className="text-[11px] truncate" style={{ color: 'var(--fg-2)' }}>
                    {creator?.fullName ?? 'Host'} is speaking
                </span>
                <span className="ml-auto inline-flex items-end gap-[2px] text-[oklch(0.72_0.22_20)]">
                    {[8, 12, 9, 11].map((h, i) => (
                        <span key={i} style={{ width: 2, height: h, background: 'currentColor', borderRadius: 1, opacity: 0.8, animation: `wf ${0.9 + i * 0.2}s ease-in-out ${i * 0.2}s infinite alternate` }} />
                    ))}
                </span>
            </div>
        </div>
    );
};
