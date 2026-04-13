import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { Zap, Star, Crown, ChevronRight } from 'lucide-react'
import TopBar from '@/components/TopBar'
import { FeaturedLiveRoom } from './components/FeaturedLiveRoom'
import { AlbumGoals } from './components/AlbumGoals'
import { ActivityStats } from './components/ActivityStats'
import { useWalletStore } from '@/stores/useWalletStore'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

const TIER_CONFIG = {
    FREE:    { label: 'Free',    icon: Zap,   color: 'text-zinc-400',   bg: 'bg-zinc-400/10' },
    PREMIUM: { label: 'Premium', icon: Star,  color: 'text-purple-400', bg: 'bg-purple-400/10' },
    CREATOR: { label: 'Creator', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
} as const

const HomePage = () => {
    const { user } = useUser()
    const name = user?.firstName ?? user?.fullName ?? ''
    const { userTier, fetchWallet } = useWalletStore()

    useEffect(() => { fetchWallet() }, [fetchWallet])

    const tier = TIER_CONFIG[userTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.FREE
    const TierIcon = tier.icon

    return (
        <div className='flex flex-col min-h-full bg-zinc-950 text-white'>
            <TopBar />

            <div className='px-8 py-10 space-y-16'>
                {/* Greeting */}
                <section>
                    <h1 className='text-4xl font-semibold tracking-tight'>Good evening {name ? `,  ${name}` : ''}</h1>
                    <p className='text-zinc-500 mt-2 font-light'>
                        Explore live listening rooms or support your favorite artists.
                    </p>
                    <div className='flex items-center gap-3 mt-4'>
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full', tier.bg, tier.color)}>
                            <TierIcon className='size-3' />
                            {tier.label} Plan
                        </span>
                        {userTier === 'FREE' && (
                            <Link
                                to='/subscription'
                                className='flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors'
                            >
                                Upgrade <ChevronRight className='size-3' />
                            </Link>
                        )}
                    </div>
                </section>

                <FeaturedLiveRoom />
                <AlbumGoals />
                <ActivityStats />

                <footer className='pt-10 border-t border-white/5 text-zinc-500 text-xs flex justify-between pb-4'>
                    <div>© 2024 Spacic. All rights reserved.</div>
                    <div className='flex gap-6'>
                        <a href='#' className='hover:text-white transition-colors'>Privacy</a>
                        <a href='#' className='hover:text-white transition-colors'>Terms</a>
                        <a href='#' className='hover:text-white transition-colors'>Help</a>
                    </div>
                </footer>
            </div>
        </div>
    )
}

export default HomePage
