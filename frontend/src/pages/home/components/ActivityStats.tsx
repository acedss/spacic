import { Wallet, Calendar, HeartHandshake, BadgeCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCard {
    icon: LucideIcon
    period: string
    value: string
    sub: string
}

const stats: StatCard[] = [
    { icon: Wallet, period: 'Balance', value: '1,250', sub: 'Coins earned' },
    { icon: Calendar, period: 'This Week', value: '12', sub: 'Rooms joined' },
    { icon: HeartHandshake, period: 'All Time', value: '$450', sub: 'Total donated' },
    { icon: BadgeCheck, period: 'Funded', value: '8', sub: 'Albums helped' },
]

export const ActivityStats = () => {
    return (
        <section>
            <h2 className='text-2xl font-semibold tracking-tight mb-8'>Your Activity</h2>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {stats.map(({ icon: Icon, period, value, sub }) => (
                    <div
                        key={period}
                        className='bg-zinc-900 p-6 rounded-2xl border border-white/5 flex flex-col justify-between aspect-[1.4/1]'
                    >
                        <div className='flex items-center justify-between'>
                            <Icon className='size-5 text-zinc-500' />
                            <span className='text-[10px] text-zinc-500 font-bold uppercase tracking-wider'>
                                {period}
                            </span>
                        </div>
                        <div>
                            <div className='text-3xl font-semibold'>{value}</div>
                            <div className='text-xs text-zinc-500 mt-1'>{sub}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
