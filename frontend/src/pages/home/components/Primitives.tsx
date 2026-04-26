export const LiveDot = () => <span className="live-dot" style={{ width: 6, height: 6 }} />

export const MiniWave = ({ count = 28 }: { count?: number }) => {
    const bars = Array.from({ length: count }, (_, i) => {
        const v = 0.25 + Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.27)) * 0.9
        return Math.max(0.18, Math.min(1, v))
    })
    return (
        <div className="flex items-end gap-[2px] h-[18px]">
            {bars.map((h, i) => (
                <span key={i} style={{
                    height: `${h * 100}%`, width: 2,
                    background: 'white', opacity: 0.6, borderRadius: 2,
                    animation: `wf ${1 + (i % 5) * 0.15}s ease-in-out ${i * 0.03}s infinite alternate`,
                }} />
            ))}
        </div>
    )
}

export const Equalizer = () => (
    <span className="inline-flex items-end gap-[2px] text-[oklch(0.82_0.17_20)]">
        {[8, 13, 9, 12].map((h, i) => (
            <span key={i} style={{ width: 2, height: h, background: 'currentColor', borderRadius: 1, opacity: 0.8, animation: `wf ${0.9 + i * 0.2}s ease-in-out ${i * 0.2}s infinite alternate` }} />
        ))}
    </span>
)
