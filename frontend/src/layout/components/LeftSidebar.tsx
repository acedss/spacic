import { Home, Search, Users, Target, Wallet, User, Crown, Radio, UserPlus, Zap, Heart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWalletStore } from '@/stores/useWalletStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { axiosInstance } from '@/lib/axios'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface LeftSidebarProps {
    isCollapsed: boolean
}

type RoomState = 'none' | 'offline' | 'live'



const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/rooms', icon: Users, label: 'Co-listening Rooms' },
    { to: '/friends', icon: UserPlus, label: 'Friends' },
    { to: '/favorites', icon: Heart, label: 'Favorites' },
    { to: '/goal', icon: Target, label: 'Album Goals' },
    { to: '/wallet', icon: Wallet, label: 'Wallet', isWallet: true },
    { to: '/subscription', icon: Crown, label: 'Subscription' },
    { to: '/profile', icon: User, label: 'Profile' },
]

export const LeftSidebar = ({ isCollapsed }: LeftSidebarProps) => {
    const { user } = useUser()
    const { isAdmin } = useAuthStore()
    const { balance } = useWalletStore()
    const navigate = useNavigate()
    const socket   = useSocialSocket()
    const [roomState, setRoomState] = useState<RoomState>('none')
    const [liveRoomId, setLiveRoomId] = useState<string | null>(null)
    const [listenerCount, setListenerCount] = useState(0)
    // When creator is actively in the room, useRoomStore has live listener count
    const storeListenerCount = useRoomStore(s => s.listenerCount)
    const isCreator = useRoomStore(s => s.isCreator)
    const effectiveListenerCount = (roomState === 'live' && isCreator && storeListenerCount > 0)
        ? storeListenerCount
        : listenerCount

    // Fetch initial room status from REST on mount
    useEffect(() => {
        axiosInstance.get('/rooms/me/room')
            .then(({ data }) => {
                const room = data.data
                if (!room) return
                setRoomState(room.status === 'live' ? 'live' : 'offline')
                if (room.status === 'live') {
                    setLiveRoomId(room._id)
                    setListenerCount(room.listenerCount ?? 0)
                }
            })
            .catch(() => {})
    }, [])

    // Real-time room status via shared socket
    useEffect(() => {
        if (!socket) return

        const onLive    = ({ roomId }: { roomId: string }) => { setRoomState('live'); setLiveRoomId(roomId); setListenerCount(0) }
        const onOffline = () => { setRoomState('offline'); setLiveRoomId(null); setListenerCount(0) }

        socket.on('creator:room_live',    onLive)
        socket.on('creator:room_offline', onOffline)

        return () => {
            socket.off('creator:room_live',    onLive)
            socket.off('creator:room_offline', onOffline)
        }
    }, [socket])

    const handleGoLiveCta = () => {
        if (roomState === 'live' && liveRoomId) {
            navigate(`/rooms/${liveRoomId}`)
        } else {
            navigate('/creator')
        }
    }

    const ctaLabel = roomState === 'live' ? 'Live Now' : roomState === 'offline' ? 'Go Live' : 'Create Room'
    const ctaColor = roomState === 'live'
        ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'

    return (
        <TooltipProvider delayDuration={200}>
            <div className='flex flex-col h-full pt-4 '>

                {/* Logo */}
                <div className='flex items-center mb-8'>
                    <div className='w-16 flex justify-center shrink-0'>
                        <img src="/spotify.svg" className="size-10 border rounded-4xl border-indigo-900" />
                    </div>
                    {!isCollapsed && (
                        <span className='whitespace-nowrap text-purple-300 pr-8'>Spacic</span>
                    )}
                </div>

                {/* Nav */}
                <nav className='flex-1 space-y-1'>
                    {navItems.map(({ to, icon: Icon, label, isWallet }) => {
                        const isProfile = to === '/profile'
                        const badge = isWallet && balance > 0
                            ? `${balance.toLocaleString()} 🪙`
                            : undefined

                        const linkEl = (
                            <Link
                                key={to}
                                to={to}
                                className='flex items-center py-3 text-white hover:text-purple-300 transition-colors'
                            >
                                <div className='w-16 flex justify-center shrink-0 m-0.5'>
                                    <Icon className='size-5' />
                                </div>
                                {!isCollapsed && (
                                    <div className='flex items-center flex-1 pr-4 whitespace-nowrap'>
                                        <span>{label}</span>
                                        {badge && (
                                            <span className='ml-auto bg-purple-600 text-white text-xs px-2 py-1 rounded-full'>
                                                {badge}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </Link>
                        )

                        // Profile: Popover (click-triggered, works on touch)
                        if (isProfile) {
                            return (
                                <Popover key={to}>
                                    <PopoverTrigger asChild>{linkEl}</PopoverTrigger>
                                    <PopoverContent
                                        side="right"
                                        sideOffset={12}
                                        className="p-0 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
                                    >
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                {user?.imageUrl ? (
                                                    <img
                                                        src={user.imageUrl}
                                                        alt={user.fullName ?? 'User'}
                                                        className="size-10 rounded-full object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                                        <User className="size-4 text-zinc-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">
                                                        {user?.fullName ?? 'User'}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-400 truncate">
                                                        {user?.primaryEmailAddress?.emailAddress}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {isAdmin && (
                                                    <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                        Admin
                                                    </span>
                                                )}
                                                <span className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full">
                                                    Free tier
                                                </span>
                                            </div>
                                            <div className="pt-2 border-t border-white/5">
                                                <Link
                                                    to="/profile"
                                                    className="block text-center text-[11px] font-semibold py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    View Profile
                                                </Link>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )
                        }

                        // Other items: tooltip only when collapsed
                        if (!isCollapsed) return linkEl

                        return (
                            <Tooltip key={to}>
                                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                                <TooltipContent side="right" sideOffset={12}>
                                    <span>{label}</span>
                                    {badge && (
                                        <span className="ml-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {badge}
                                        </span>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </nav>

                {/* Go Live / Create Room CTA */}
                <div className='pb-6 px-2'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleGoLiveCta}
                                className={`w-full flex items-center rounded-xl py-2.5 transition-all ${ctaColor}`}
                            >
                                <div className='w-12 flex justify-center shrink-0'>
                                    {roomState === 'live'
                                        ? <span className='w-2 h-2 rounded-full bg-green-400 animate-pulse' />
                                        : <Zap className='size-4' />
                                    }
                                </div>
                                {!isCollapsed && (
                                    <div className='flex flex-col pr-4'>
                                        <span className='text-sm font-semibold whitespace-nowrap leading-tight'>
                                            {roomState === 'live' ? 'Live Now' : ctaLabel}
                                        </span>
                                        {roomState === 'live' && effectiveListenerCount > 0 && (
                                            <span className='text-[10px] text-green-400/70 leading-tight'>
                                                {effectiveListenerCount} listener{effectiveListenerCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        </TooltipTrigger>
                        {isCollapsed && (
                            <TooltipContent side="right" sideOffset={12}>
                                <span>{ctaLabel}</span>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    )
}
