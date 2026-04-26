export const HomeFooter = () => (
    <footer className="px-10 py-12 border-t hair">
        <div className="flex items-baseline justify-between">
            <span className="serif italic text-white/70" style={{ fontSize: 24 }}>
                spacic<span className="mono not-italic text-[10px] ml-1" style={{ color: 'var(--fg-3)' }}>.fm</span>
            </span>
            <div className="flex gap-8 text-[12px]" style={{ color: 'var(--fg-3)' }}>
                <a href="#" className="hover:text-white transition-colors">About</a>
                <a href="#" className="hover:text-white transition-colors">For creators</a>
                <a href="#" className="hover:text-white transition-colors">Press kit</a>
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
        </div>
    </footer>
)
