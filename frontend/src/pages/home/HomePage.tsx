import { useUser } from '@clerk/clerk-react'
import TopBar from '@/components/TopBar'
import { FeaturedLiveRoom } from './compoments/FeaturedLiveRoom'
import { AlbumGoals } from './compoments/AlbumGoals'
import { ActivityStats } from './compoments/ActivityStats'

const HomePage = () => {
    const { user } = useUser()
    const name = user?.firstName ?? user?.fullName ?? ''
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
