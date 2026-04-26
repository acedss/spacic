import type { ElementType } from 'react';

interface Props {
    icon: ElementType;
    label: string;
    value: number | string;
}

export const MiniStat = ({ icon: Icon, label, value }: Props) => (
    <div className="flex flex-col items-center gap-0.5 px-3">
        <Icon className="size-3.5 mb-0.5" style={{ color: 'var(--fg-3)' }} />
        <span className="mono text-[15px] font-bold text-white tabular-nums leading-none">{value}</span>
        <span className="mono text-[8px] uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--fg-3)' }}>{label}</span>
    </div>
);
