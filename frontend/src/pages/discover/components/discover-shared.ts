export const SOURCE_META: Record<string, { label: string; color: string }> = {
    cache:    { label: 'Personalized',   color: 'text-violet-400 bg-violet-400/10 ring-violet-400/20' },
    content:  { label: 'Tag match',      color: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20' },
    fallback: { label: 'Top rooms',      color: 'text-amber-400 bg-amber-400/10 ring-amber-400/20' },
    offline:  { label: 'RecSys offline', color: 'text-zinc-400 bg-zinc-400/10 ring-zinc-400/20' },
};
