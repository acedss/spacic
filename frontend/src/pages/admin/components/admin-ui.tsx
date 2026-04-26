// Admin UI primitives — consistent typography, spacing, and surfaces across all admin sections.
// Aligned with design tokens defined in src/index.css (--ink-*, --fg-*, .hair).

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader, ChevronRight } from 'lucide-react';

// ── Page header ───────────────────────────────────────────────────────────────

export const AdminPageHeader = ({
    eyebrow, title, description, actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
            {eyebrow && (
                <p className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>
                    {eyebrow}
                </p>
            )}
            <h2 className="serif text-white text-2xl sm:text-3xl tracking-[-0.01em] mt-1">
                {title}
            </h2>
            {description && (
                <p className="text-sm mt-1.5 max-w-2xl" style={{ color: 'var(--fg-2)' }}>
                    {description}
                </p>
            )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
);

// ── Card / Surface ────────────────────────────────────────────────────────────

export const AdminCard = ({
    title, subtitle, actions, children, className, padding = 'normal',
}: {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    padding?: 'tight' | 'normal' | 'loose' | 'none';
}) => {
    const padCls = {
        none: '',
        tight: 'p-3 sm:p-4',
        normal: 'p-4 sm:p-5',
        loose: 'p-5 sm:p-7',
    }[padding];
    return (
        <section
            className={cn(
                'rounded-2xl ring-1 ring-white/10 transition-colors',
                padCls,
                className,
            )}
            style={{ background: 'var(--ink-1)' }}
        >
            {(title || actions) && (
                <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="min-w-0">
                        {title && <h3 className="text-[15px] font-semibold text-white">{title}</h3>}
                        {subtitle && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
                </header>
            )}
            {children}
        </section>
    );
};

// ── Stat tile ─────────────────────────────────────────────────────────────────

export const StatTile = ({
    label, value, sub, accent, icon: Icon, delta,
}: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    accent?: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'zinc';
    icon?: React.ElementType;
    delta?: { value: number | null; label?: string };
}) => {
    const accentBg: Record<string, string> = {
        violet:  'bg-violet-500/10 text-violet-300',
        emerald: 'bg-emerald-500/10 text-emerald-300',
        amber:   'bg-amber-500/10 text-amber-300',
        sky:     'bg-sky-500/10 text-sky-300',
        rose:    'bg-rose-500/10 text-rose-300',
        zinc:    'bg-white/5 text-zinc-300',
    };
    const aCls = accentBg[accent ?? 'zinc'];
    const deltaColor = delta && delta.value !== null
        ? delta.value > 0 ? 'text-emerald-400'
        : delta.value < 0 ? 'text-rose-400'
        : 'text-zinc-500'
        : 'text-zinc-500';

    return (
        <div className="rounded-2xl ring-1 ring-white/10 p-4 sm:p-5" style={{ background: 'var(--ink-1)' }}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-medium" style={{ color: 'var(--fg-3)' }}>
                    {label}
                </p>
                {Icon && (
                    <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', aCls)}>
                        <Icon className="size-4" />
                    </div>
                )}
            </div>
            <p className="text-2xl sm:text-[28px] font-semibold text-white mt-2 tabular-nums tracking-tight">
                {value}
            </p>
            {(sub || delta) && (
                <div className="flex items-center gap-2 mt-1.5 text-xs">
                    {delta && (
                        <span className={cn('font-medium tabular-nums', deltaColor)}>
                            {delta.value === null ? '—' : `${delta.value > 0 ? '+' : ''}${delta.value}%`}
                            {delta.label && <span className="ml-1 text-zinc-500 font-normal">{delta.label}</span>}
                        </span>
                    )}
                    {sub && <span style={{ color: 'var(--fg-3)' }}>{sub}</span>}
                </div>
            )}
        </div>
    );
};

// ── Empty state ───────────────────────────────────────────────────────────────

export const AdminEmptyState = ({
    icon: Icon, title, description, action,
}: {
    icon?: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {Icon && (
            <div className="size-12 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center mb-3">
                <Icon className="size-5" style={{ color: 'var(--fg-3)' }} />
            </div>
        )}
        <p className="text-sm font-medium text-white">{title}</p>
        {description && (
            <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--fg-3)' }}>
                {description}
            </p>
        )}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

// ── Loading state ─────────────────────────────────────────────────────────────

export const AdminLoading = ({ label = 'Loading…', className }: { label?: string; className?: string }) => (
    <div className={cn('flex items-center gap-2 py-6', className)} style={{ color: 'var(--fg-3)' }}>
        <Loader className="size-4 animate-spin" />
        <span className="text-sm">{label}</span>
    </div>
);

// ── Section divider ───────────────────────────────────────────────────────────

export const AdminDivider = ({ label }: { label?: string }) => (
    <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-white/5" />
        {label && (
            <span className="mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>
                {label}
            </span>
        )}
        <div className="flex-1 h-px bg-white/5" />
    </div>
);

// ── Tabs (within a section) ───────────────────────────────────────────────────

export const AdminPills = <T extends string>({
    options, value, onChange, ariaLabel,
}: {
    options: { value: T; label: string; count?: number }[];
    value: T;
    onChange: (v: T) => void;
    ariaLabel?: string;
}) => (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        {options.map(opt => (
            <button
                key={opt.value}
                role="tab"
                aria-selected={value === opt.value}
                onClick={() => onChange(opt.value)}
                className={cn(
                    'px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 min-h-[32px]',
                    value === opt.value
                        ? 'bg-white/15 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5',
                )}
            >
                {opt.label}
                {opt.count !== undefined && (
                    <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] tabular-nums',
                        value === opt.value ? 'bg-white/15 text-white' : 'bg-white/5 text-zinc-500',
                    )}>
                        {opt.count}
                    </span>
                )}
            </button>
        ))}
    </div>
);

// ── Chips (read-only badges, e.g. genre tags) ─────────────────────────────────

const CHIP_TONES: Record<string, string> = {
    zinc:    'bg-white/5 text-zinc-300 ring-white/10',
    violet:  'bg-violet-500/10 text-violet-300 ring-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-300 ring-amber-500/20',
    rose:    'bg-rose-500/10 text-rose-300 ring-rose-500/20',
    sky:     'bg-sky-500/10 text-sky-300 ring-sky-500/20',
};

export const Chip = ({
    children, tone = 'zinc', icon: Icon, size = 'sm',
}: {
    children: React.ReactNode;
    tone?: keyof typeof CHIP_TONES;
    icon?: React.ElementType;
    size?: 'xs' | 'sm';
}) => (
    <span className={cn(
        'inline-flex items-center gap-1 rounded-full ring-1 font-medium',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
        CHIP_TONES[tone],
    )}>
        {Icon && <Icon className="size-3" />}
        {children}
    </span>
);

// ── Field label / row ─────────────────────────────────────────────────────────

export const FieldLabel = ({
    children, required, hint,
}: { children: React.ReactNode; required?: boolean; hint?: string }) => (
    <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg-2)' }}>
        {children}
        {required && <span className="text-rose-400 ml-1">*</span>}
        {hint && <span className="ml-2 normal-case font-normal text-[10px]" style={{ color: 'var(--fg-3)' }}>{hint}</span>}
    </label>
);

export const InfoRow = ({
    label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) => (
    <div className={cn('flex items-start justify-between gap-4 py-2', className)}>
        <span className="text-xs uppercase tracking-wider shrink-0" style={{ color: 'var(--fg-3)' }}>
            {label}
        </span>
        <span className="text-sm text-right text-white min-w-0 break-words">
            {children}
        </span>
    </div>
);

// ── Clickable table row that opens a detail Sheet ─────────────────────────────

export const RowChevron = () => (
    <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--fg-3)' }} />
);

// ── Responsive grid helpers ───────────────────────────────────────────────────

export const StatGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)}>
        {children}
    </div>
);

export const TwoColumn = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5', className)}>
        {children}
    </div>
);
