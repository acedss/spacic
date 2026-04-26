import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import type { RoomData } from './shared'
import { TasteCard } from './TasteCard'

interface Props {
    rooms: RoomData[]
    tasteRooms: RoomData[]
    loading: boolean
    onJoin: (id: string) => void
}

export const TasteRowSection = ({ rooms, tasteRooms, loading, onJoin }: Props) => {
    const navigate = useNavigate()
    const display = tasteRooms.length > 0 ? tasteRooms : rooms.slice(0, 5)

    return (
        <section className="px-10 py-16 relative">
            <div className="flex items-end justify-between mb-8">
                <div>
                    <div className="mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--fg-3)' }}>
                        Because you replayed <span className="text-white/80">"Harbor"</span> three nights in a row
                    </div>
                    <h2 className="serif text-white leading-tight" style={{ fontSize: 44 }}>Quieter corners of the dial.</h2>
                </div>
                <button onClick={() => navigate('/rooms')}
                    className="inline-flex items-center gap-1 text-[12px] hover:text-white transition-colors"
                    style={{ color: 'var(--fg-2)' }}>
                    View all <ChevronRight className="size-3" />
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl bg-white/5" />)}
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-4">
                    {display.map(r => <TasteCard key={r._id} room={r} onJoin={onJoin} />)}
                </div>
            )}
        </section>
    )
}
