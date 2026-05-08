import { axiosInstance } from '@/lib/axios'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Loader } from 'lucide-react'

const AuthCallbackPage = () => {
    const { isLoaded, user } = useUser()
    const navigate = useNavigate()

    useEffect(() => {
        const syncUser = async () => {
            if (!isLoaded || !user) return
            try {
                const { data } = await axiosInstance.post('/auth/callback', {
                    clerkId: user.id,
                    fullName: user.fullName || `${user.firstName} ${user.lastName}`,
                    imageUrl: user.imageUrl,
                    role: 'USER',
                    username: user.username ?? undefined,
                })

                // Backend returns isNew (first-ever login) and onboardingCompleted (DB flag)
                const onboardingDone = data?.onboardingCompleted === true

                if (!onboardingDone) {
                    setTimeout(() => navigate('/onboarding'), 10)
                } else {
                    setTimeout(() => navigate('/'), 10)
                }
            } catch (error) {
                console.error('Sync Error:', error)
                setTimeout(() => navigate('/'), 10)
            }
        }
        syncUser()
    }, [isLoaded, user, navigate])

    return (
        <div className="flex items-center justify-center w-full h-screen flex-col gap-5"
            style={{ background: 'var(--ink-0)', fontFamily: "'Figtree', system-ui, sans-serif" }}>
            <div className="aurora aurora-breathe" style={{ position: 'fixed', inset: -60 }} />
            <div className="grain" style={{ position: 'fixed', inset: 0 }} />
            <div className="relative z-10 flex flex-col items-center gap-5">
                <span className="serif italic text-white" style={{ fontSize: 32 }}>spacic</span>
                <Loader className="size-5 animate-spin text-[oklch(0.88_0.12_75)]" />
                <p className="mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>
                    Logging you in…
                </p>
            </div>
        </div>
    )
}

export default AuthCallbackPage
