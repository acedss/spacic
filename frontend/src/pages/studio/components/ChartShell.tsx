export const ChartShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-zinc-400 font-medium mb-3">{title}</p>
        {children}
    </div>
)
