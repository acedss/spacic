import { Sparkles, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const OnboardingBanner = ({ onDismiss }: { onDismiss: () => void }) => {
    const navigate = useNavigate()
    return (
        <div className="relative z-20 flex items-center gap-4 px-10 py-3 border-b hair"
            style={{ background: 'linear-gradient(90deg, oklch(0.68 0.21 295 / 0.1), oklch(0.88 0.12 75 / 0.1))' }}>
            <Sparkles className="size-4 text-[oklch(0.88_0.12_75)]" />
            <span className="text-[13px] text-white flex-1">Complete your setup to get personalized recommendations and 100 bonus coins.</span>
            <button onClick={() => navigate('/onboarding')}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">
                <Zap className="size-3.5" /> Finish setup
            </button>
            <button onClick={onDismiss}
                className="text-[var(--fg-3)] hover:text-white text-[12px]">✕</button>
        </div>
    )
}
