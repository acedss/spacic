import { Home, Search, Users, Target, Wallet, User, PanelRightOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

interface LeftSidebarProps {
    isCollapsed: boolean
    onToggle: () => void
}

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/rooms', icon: Users, label: 'Co-listening Rooms' },
    { to: '/goal', icon: Target, label: 'Album Goals' },
    { to: '/wallet', icon: Wallet, label: 'Wallet', badge: '1,250' },
    { to: '/profile', icon: User, label: 'Profile' },
]

export const LeftSidebar = ({ isCollapsed, onToggle }: LeftSidebarProps) => {
    return (
        <div className='flex flex-col h-full relative pt-4'>

            {/* Toggle button: absolute so it never affects flow */}
            <button
                onClick={onToggle}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className='absolute top-3 pt-4 right-2 text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 rounded-md p-1 transition-colors z-10'
            >
                {!isCollapsed &&
                    <PanelRightOpen className='size-4' />
                }
            </button>

            {/* Header: icon lives in same fixed w-16 column as nav icons */}
            <div className='flex items-center mb-6'>
                <div className='w-16 flex justify-center shrink-0'>
                    <img src="/spotify.svg" className="size-10 border rounded-4xl border-indigo-900" />
                </div>
                {!isCollapsed && (
                    <span className='whitespace-nowrap text-purple-300 pr-8'>Spacic</span>
                )}
            </div>

            {/* Nav: icon always centered in fixed w-16 slot — zero movement */}
            <nav className='flex-1 space-y-1'>
                {navItems.map(({ to, icon: Icon, label, badge }) => (
                    <Link
                        key={to}
                        to={to}
                        title={isCollapsed ? label : undefined}
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
                ))}
            </nav>

            {/* {!isCollapsed && (
                <div className='mt-auto mb-4 mx-4'>
                    <div className='bg-linear-to-br from-purple-600 to-pink-600 rounded-lg p-4'>
                        <h3 className='text-white font-semibold mb-1'>Go Live Now</h3>
                        <p className='text-purple-100 text-sm'>Start your own co-listening room</p>
                    </div>
                </div>
            )} */}
        </div>
    )
}
