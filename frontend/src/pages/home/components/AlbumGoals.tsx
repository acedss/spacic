import { Link } from 'react-router-dom'
import { AlbumGoalCard } from './AlbumGoalCard'

const albumGoals = [
    {
        id: '1',
        title: 'Neon Nights',
        artist: 'Cyber Dreams',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
        raised: 12450,
        goal: 20000,
    },
    {
        id: '2',
        title: 'Smooth Sessions',
        artist: 'Jazz Collective',
        cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80',
        raised: 15000,
        goal: 15000,
    },
    {
        id: '3',
        title: 'Thunder Road',
        artist: 'The Rock Brigade',
        cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&auto=format&fit=crop&q=80',
        raised: 8200,
        goal: 25000,
    },
    {
        id: '4',
        title: 'Pop Paradise',
        artist: 'Luna Star',
        cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80',
        raised: 18900,
        goal: 22000,
    },
]

export const AlbumGoals = () => {
    return (
        <section>
            <div className='flex items-center justify-between mb-8'>
                <h2 className='text-2xl font-semibold tracking-tight'>Album Goals You Can Support</h2>
                <Link to='/goal' className='text-sm font-medium text-blue-400 hover:underline'>
                    See all
                </Link>
            </div>
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                {albumGoals.map(goal => (
                    <AlbumGoalCard key={goal.id} {...goal} />
                ))}
            </div>
        </section>
    )
}
