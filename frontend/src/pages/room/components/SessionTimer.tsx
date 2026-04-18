import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';

export const SessionTimer = () => {
    const sessionInfo = useRoomStore((s) => s.sessionInfo);
    const [remaining, setRemaining] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionInfo?.maxSessionMinutes || !sessionInfo?.liveAt) {
            setRemaining(null);
            return;
        }

        const maxMs = sessionInfo.maxSessionMinutes * 60_000;
        const liveAtMs = new Date(sessionInfo.liveAt).getTime();

        const tick = () => {
            const elapsed = Date.now() - liveAtMs;
            const left = Math.max(0, maxMs - elapsed);
            if (left <= 0) { setRemaining('0:00'); return; }
            const mins = Math.floor(left / 60_000);
            const secs = Math.floor((left % 60_000) / 1000);
            setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [sessionInfo]);

    if (!remaining) return null;

    const isLow = remaining !== null && parseInt(remaining) <= 5;

    return (
        <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
            isLow ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800/60 text-zinc-400'
        }`}>
            <Clock className="size-3" />
            <span>{remaining}</span>
        </div>
    );
};
