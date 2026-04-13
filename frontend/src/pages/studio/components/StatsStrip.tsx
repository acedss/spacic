import { Radio, Users, Clock, Gem, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoomInfo } from '@/types/types'

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export const StatsStrip = ({ room }: { room: RoomInfo }) => {
    const s = room.stats
    const items = [
        { icon: Radio,  label: 'Sessions',  value: s.totalSessions.toLocaleString(),    color: 'text-purple-400' },
        { icon: Users,  label: 'Listeners', value: s.totalListeners.toLocaleString(),   color: 'text-blue-400'   },
        { icon: Clock,  label: 'Listened',  value: toHours(s.totalMinutesListened),     color: 'text-indigo-400' },
        { icon: Gem,    label: 'Coins',     value: s.totalCoinsEarned.toLocaleString(), color: 'text-yellow-400' },
        { icon: Heart,  label: 'Favorites', value: room.favoriteCount.toLocaleString(), color: 'text-pink-400'   },
    ]
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {items.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Icon className={cn('size-4 mx-auto mb-1', color)} />
                    <p className="text-sm font-bold text-white">{value}</p>
                    <p className="text-[10px] text-zinc-500">{label}</p>
                </div>
            ))}
        </div>
    )
}
