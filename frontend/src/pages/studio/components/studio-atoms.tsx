import { cn } from '@/lib/utils';

export const SectionHead = ({ label, sub }: { label: string; sub?: string }) => (
    <div>
        <p className="mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--fg-3)' }}>{label}</p>
        {sub && <p className="text-[12px]" style={{ color: 'var(--fg-2)' }}>{sub}</p>}
    </div>
);

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-3)' }}>{children}</p>
);

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('rounded-2xl ring-1 ring-white/10 p-5', className)} style={{ background: 'var(--ink-2)' }}>
        {children}
    </div>
);
