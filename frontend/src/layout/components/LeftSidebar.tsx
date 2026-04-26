import { Home, Search, Sparkles, Users, Target, Wallet, User, Crown, Radio, UserPlus, UserCheck, Zap, LayoutDashboard } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWalletStore } from '@/stores/useWalletStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { useSubscriptionStore } from '@/stores/useSubscriptionStore'
import { axiosInstance } from '@/lib/axios'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface LeftSidebarProps {
    isCollapsed: boolean
}

type RoomState = 'none' | 'offline' | 'live'

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/discover', icon: Sparkles, label: 'Discover' },
    { to: '/rooms', icon: Users, label: 'Live Rooms' },
    { to: '/friends', icon: UserPlus, label: 'Friends' },
    { to: '/favorites', icon: UserCheck, label: 'Following' },
    { to: '/goal', icon: Target, label: 'Album Goals' },
    { to: '/studio', icon: Radio, label: 'Creator Studio' },
    { to: '/wallet', icon: Wallet, label: 'Wallet', isWallet: true },
    { to: '/subscription', icon: Crown, label: 'Subscription' },
    { to: '/admin', icon: LayoutDashboard, label: 'Admin', isAdmin: true },
    { to: '/profile', icon: User, label: 'Profile' },
]

export const LeftSidebar = ({ isCollapsed }: LeftSidebarProps) => {
    const { user } = useUser()
    const { isAdmin } = useAuthStore()
    const { balance } = useWalletStore()
    const { subStatus, fetchSubStatus } = useSubscriptionStore()
    const location = useLocation()
    const navigate = useNavigate()
    const socket = useSocialSocket()
    const [roomState, setRoomState] = useState<RoomState>('none')
    const [listenerCount, setListenerCount] = useState(0)
    const storeListenerCount = useRoomStore(s => s.listenerCount)
    const isCreator = useRoomStore(s => s.isCreator)
    const effectiveListenerCount = (roomState === 'live' && isCreator && storeListenerCount > 0)
        ? storeListenerCount
        : listenerCount

    useEffect(() => { fetchSubStatus() }, [fetchSubStatus])

    useEffect(() => {
        axiosInstance.get('/rooms/me/room')
            .then(({ data }) => {
                const room = data.data
                if (!room) return
                setRoomState(room.status === 'live' ? 'live' : 'offline')
                if (room.status === 'live') setListenerCount(room.listenerCount ?? 0)
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (!socket) return
        const onLive = () => { setRoomState('live'); setListenerCount(0) }
        const onOffline = () => { setRoomState('offline'); setListenerCount(0) }
        socket.on('creator:room_live', onLive)
        socket.on('creator:room_offline', onOffline)
        return () => {
            socket.off('creator:room_live', onLive)
            socket.off('creator:room_offline', onOffline)
        }
    }, [socket])

    const handleGoLiveCta = () => {
        navigate(roomState === 'live' ? '/studio/live' : '/studio')
    }

    const visibleNav = navItems.filter(n => !n.isAdmin || isAdmin)

    return (
        <TooltipProvider delayDuration={200}>
            <div className='flex flex-col h-full' style={{ background: 'var(--ink-1)' }}>

                {/* Brand */}
                <div className={cn('border-b hair shrink-0', isCollapsed ? 'px-4 py-5' : 'px-6 pt-7 pb-6')}>
                    {isCollapsed ? (
                        <div className='flex justify-center pt-3 pb-7.5'>
                            <span className='serif italic text-white text-[22px] leading-none'>s</span>
                        </div>
                    ) : (
                        <>
                            <div className='flex items-baseline gap-1.5'>
                                <span className='serif italic text-[28px] leading-none text-white'>spacic</span>
                                <span className='mono text-[9px] text-(--fg-3) uppercase tracking-widest'>fm</span>
                            </div>
                            <p className='mt-1 text-[11px] text-(--fg-3) whitespace-nowrap'>Listening, together.</p>
                        </>
                    )}
                </div>

                {/* Nav */}
                <nav className='flex-1 overflow-y-auto hide-scrollbar px-3 pt-4 space-y-0.5 whitespace-nowrap'>
                    {visibleNav.map(({ to, icon: Icon, label, isWallet }) => {
                        const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                        const badge = isWallet && balance > 0 ? balance.toLocaleString() : undefined

                        const inner = (
                            <Link
                                key={to}
                                to={to}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-xl text-left press transition-all',
                                    isActive
                                        ? 'bg-white/8 text-white ring-1 ring-white/10'
                                        : 'text-(--fg-2) hover:bg-white/4 hover:text-white'
                                )}
                            >
                                <Icon className='size-4 shrink-0' />
                                {!isCollapsed && (
                                    <>
                                        <span className='text-[13px] flex-1 whitespace-nowrap'>{label}</span>
                                        {badge && (
                                            <span className='mono text-[10px] bg-white/8 text-(--fg-2) px-1.5 py-0.5 rounded-md'>
                                                {badge}
                                            </span>
                                        )}
                                        {isActive && (
                                            <span className='mono text-[9px] text-(--fg-3)'>
                                                {String(visibleNav.findIndex(n => n.to === to) + 1).padStart(2, '0')}
                                            </span>
                                        )}
                                    </>
                                )}
                            </Link>
                        )

                        if (isCollapsed) {
                            return (
                                <Tooltip key={to}>
                                    <TooltipTrigger asChild>{inner}</TooltipTrigger>
                                    <TooltipContent side='right' sideOffset={12}>
                                        <span>{label}</span>
                                        {badge && <span className='ml-2'>{badge} coins</span>}
                                    </TooltipContent>
                                </Tooltip>
                            )
                        }
                        return inner
                    })}
                </nav>

                {/* Go Live CTA */}
                <div className='px-3 pb-3 pt-2 border-t hair shrink-0 whitespace-nowrap'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleGoLiveCta}
                                className={cn(
                                    'w-full flex items-center rounded-xl py-2.5 px-3 gap-3 press transition-all',
                                    roomState === 'live'
                                        ? 'bg-[oklch(0.72_0.22_20/0.12)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20/0.35)]'
                                        : 'bg-white/5 text-(--fg-1) ring-1 ring-white/10 hover:bg-white/8 hover:text-white'
                                )}
                            >
                                {roomState === 'live' ? (
                                    <span className='live-dot shrink-0' />
                                ) : (
                                    <Zap className='size-4 shrink-0' />
                                )}
                                {!isCollapsed && (
                                    <div className='flex flex-col min-w-0'>
                                        <span className='text-[12px] font-semibold whitespace-nowrap leading-tight'>
                                            {roomState === 'live' ? 'Live Now' : roomState === 'offline' ? 'Go Live' : 'Create Room'}
                                        </span>
                                        {roomState === 'live' && effectiveListenerCount > 0 && (
                                            <span className='mono text-[10px] text-[oklch(0.72_0.22_20)] leading-tight'>
                                                {effectiveListenerCount} listening
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        </TooltipTrigger>
                        {isCollapsed && (
                            <TooltipContent side='right' sideOffset={12}>
                                {roomState === 'live' ? 'Live Now' : 'Create Room'}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>

                {/* Premium upgrade card — hidden if already subscribed */}
                {!isCollapsed && subStatus?.tier === 'FREE' && (
                    <div className='px-3 pb-4 shrink-0'>
                        <div className='rounded-xl p-3 ring-1 ring-white/10'
                            style={{ background: 'linear-gradient(145deg, oklch(0.25 0.06 295 / 0.6), oklch(0.2 0.04 60 / 0.4))' }}>
                            <div className='flex items-center gap-2 mb-1.5'>
                                <Crown className='size-3.5 text-[oklch(0.88_0.12_75)]' />
                                <span className='mono text-[10px] tracking-wider uppercase text-white/80'>Premium</span>
                            </div>
                            <p className='text-[11px] text-white/60 leading-snug'>Unlimited rooms · higher tip cap · exclusive rooms</p>
                            <Link to='/subscription'
                                className='mt-2.5 w-full h-7 rounded-lg bg-white text-(--ink-0) text-[11px] font-semibold press flex items-center justify-center'>
                                Upgrade · $7/mo
                            </Link>
                        </div>
                    </div>
                )}

                {/* User avatar */}
                <div className={cn('px-3 pb-4 border-t hair shrink-0 pt-3', isCollapsed && 'flex justify-center')}>
                    {user && (
                        <Link to='/profile' className='flex items-center gap-2.5 press rounded-xl hover:bg-white/5 px-1.5 py-1.5'>
                            <img
                                src={user.imageUrl}
                                alt={user.fullName ?? ''}
                                className='w-8 h-8 rounded-full object-cover ring-1 ring-white/15 shrink-0'
                            />
                            {!isCollapsed && (
                                <div className='min-w-0'>
                                    <p className='text-[12px] text-white truncate leading-tight'>{user.fullName ?? user.firstName}</p>
                                    <p className='mono text-[10px] text-(--fg-3) truncate'>
                                        {isAdmin ? 'Admin' : 'Member'}
                                    </p>
                                </div>
                            )}
                        </Link>
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}
