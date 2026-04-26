// EmptyState — drop-in for any "nothing here yet" view.
// Keeps illustrations consistent: ringed icon disc + heading + tagline + optional CTA.
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    icon:        LucideIcon;
    title:       string;
    description?: string;
    action?: {
        label:   string;
        onClick: () => void;
    };
    /** Visual tone — picks the icon ring color. Defaults to violet. */
    tone?:       'violet' | 'amber' | 'emerald' | 'zinc';
    className?: string;
}

const TONE_RING: Record<NonNullable<Props['tone']>, string> = {
    violet:  'text-violet-300  ring-violet-400/20  bg-violet-500/8',
    amber:   'text-amber-300   ring-amber-400/20   bg-amber-500/8',
    emerald: 'text-emerald-300 ring-emerald-400/20 bg-emerald-500/8',
    zinc:    'text-zinc-300    ring-white/15       bg-white/5',
};

export const EmptyState = ({ icon: Icon, title, description, action, tone = 'violet', className }: Props) => (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
        <div className={cn('size-14 rounded-2xl ring-1 grid place-items-center mb-4', TONE_RING[tone])}>
            <Icon className="size-6" />
        </div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {description && (
            <p className="mt-1 text-xs text-(--fg-3) max-w-xs leading-relaxed">{description}</p>
        )}
        {action && (
            <button
                onClick={action.onClick}
                className="mt-4 px-4 py-2 rounded-xl bg-white text-(--ink-0) text-xs font-semibold press hover:bg-white/90"
            >
                {action.label}
            </button>
        )}
    </div>
);
