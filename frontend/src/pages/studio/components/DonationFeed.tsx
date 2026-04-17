// DonationFeed — scrolling real-time coin events from room:goal_updated + room:donation socket events
import { useEffect, useRef, useState } from 'react'
import { Gem } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { cn } from '@/lib/utils'

interface DonationEvent {
    id: string
    donorName: string
    amount: number
    message?: string
    at: number
}

interface Props {
    socket: Socket | null
    className?: string
}

export const DonationFeed = ({ socket, className }: Props) => {
    const [events, setEvents] = useState<DonationEvent[]>([])
    const feedEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!socket) return

        const onGoalUpdated = (data: { donor?: { name?: string; amount: number }; streamGoal?: number; streamGoalCurrent?: number }) => {
            if (!data.donor) return // goal-only update with no donor info
            const event: DonationEvent = {
                id: `${Date.now()}-${Math.random()}`,
                donorName: data.donor.name ?? 'Someone',
                amount: data.donor.amount,
                at: Date.now(),
            }
            setEvents(prev => [...prev.slice(-49), event])
        }

        socket.on('room:goal_updated', onGoalUpdated)
        return () => { socket.off('room:goal_updated', onGoalUpdated) }
    }, [socket])

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [events])

    return (
        <div className={cn('flex flex-col', className)}>
            <div className="flex items-center gap-2 mb-2">
                <Gem className="size-3.5 text-yellow-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Donation Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 max-h-44 pr-0.5">
                {events.length === 0 && (
                    <p className="text-[11px] text-zinc-700 text-center py-4">
                        Donations will appear here in real time
                    </p>
                )}
                {events.map(ev => (
                    <div
                        key={ev.id}
                        className="flex items-start gap-2 px-2.5 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl animate-in fade-in slide-in-from-bottom-1 duration-300"
                    >
                        <Gem className="size-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white">
                                <span className="font-semibold text-yellow-300">{ev.donorName}</span>
                                {' '}sent{' '}
                                <span className="font-bold">{ev.amount.toLocaleString()} 🪙</span>
                            </p>
                            {ev.message && (
                                <p className="text-[11px] text-zinc-400 truncate mt-0.5">"{ev.message}"</p>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={feedEndRef} />
            </div>
        </div>
    )
}
