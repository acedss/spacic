import { Home, Search, Users, Target, Wallet, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface LeftSidebarProps {
    isCollapsed: boolean
}

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/rooms', icon: Users, label: 'Co-listening Rooms' },
    { to: '/goal', icon: Target, label: 'Album Goals' },
    { to: '/wallet', icon: Wallet, label: 'Wallet', badge: '1,250' },
    { to: '/profile', icon: User, label: 'Profile' },
]

export const LeftSidebar = ({ isCollapsed }: LeftSidebarProps) => {
    const { user } = useUser()
    const { isAdmin } = useAuthStore()

    return (
        <TooltipProvider delayDuration={200}>
            <div className='flex flex-col h-full pt-4'>

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
                    {navItems.map(({ to, icon: Icon, label, badge }) => {
                        const isProfile = to === '/profile'

                        const linkEl = (
                            <Link
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

                        // Profile: always show card tooltip
                        if (isProfile) {
                            return (
                                <Tooltip key={to}>
                                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                                    <TooltipContent
                                        side="right"
                                        sideOffset={12}
                                        className="p-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
                                    >
                                        <div className="p-4 w-56 space-y-3">
                                            <div className="flex items-center gap-3">
                                                {user?.imageUrl ? (
                                                    <img
                                                        src={user.imageUrl}
                                                        alt={user.fullName ?? 'User'}
                                                        className="size-10 rounded-full object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
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
                                    </TooltipContent>
                                </Tooltip>
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
            </div>
        </TooltipProvider>
    )
}
