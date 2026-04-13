export const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="size-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Icon className="size-6 text-zinc-600" />
        </div>
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">{sub}</p>
    </div>
)
