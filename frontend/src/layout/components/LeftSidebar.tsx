import { Home, Search, Users, Target, Wallet, User, Crown, Radio, UserPlus, Zap, Heart, ExternalLink, X, Plus, Check, GripVertical, Loader2, Goal } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWalletStore } from '@/stores/useWalletStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { axiosInstance } from '@/lib/axios'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getSongs, goOffline, updateQueueWhileLive } from '@/lib/roomService'
import { toast } from 'sonner'
import type { Song, RoomInfo } from '@/types/types'

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

// ── Creator Live Sheet ────────────────────────────────────────────────────────

const CreatorLiveSheet = ({
    open,
    onClose,
    roomId,
    room,
    onOffline,
}: {
    open: boolean
    onClose: () => void
    roomId: string
    room: RoomInfo | null
    onOffline: () => void
}) => {
    const [allSongs, setAllSongs] = useState<Song[]>([])
    const [query, setQuery] = useState('')
    const [playlist, setPlaylist] = useState<Song[]>([])
    const [goal, setGoal] = useState('')
    const [saving, setSaving] = useState(false)
    const [goingOffline, setGoingOffline] = useState(false)
    const [songsLoaded, setSongsLoaded] = useState(false)
    const listenerCount = useRoomStore(s => s.listenerCount)

    useEffect(() => {
        if (!open) return
        getSongs(true).then(songs => {
            // Deduplicate by _id (guards against songs seeded multiple times in DB)
            const unique = songs.filter((s, i, arr) => arr.findIndex(x => x._id === s._id) === i)
            setAllSongs(unique)
            setSongsLoaded(true)
        }).catch(() => setSongsLoaded(true))

        if (room) {
            setPlaylist(room.playlist as Song[])
            setGoal(room.streamGoal > 0 ? String(room.streamGoal) : '')
        }
    }, [open, room])

    const filtered = allSongs.filter(s =>
        query.trim() === '' ? true :
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
    )

    const inPlaylist = (id: string) => playlist.some(s => s._id === id)

    const toggleSong = (song: Song) => {
        setPlaylist(prev =>
            inPlaylist(song._id)
                ? prev.filter(s => s._id !== song._id)
                : [...prev, song]
        )
    }

    const handleSave = async () => {
        if (playlist.length === 0) { toast.error('Playlist must have at least one song'); return }
        setSaving(true)
        try {
            await updateQueueWhileLive(roomId, {
                playlistIds: playlist.map(s => s._id),
                streamGoal: goal ? parseInt(goal, 10) : 0,
            })
            toast.success('Room updated')
        } catch {
            toast.error('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleGoOffline = async () => {
        setGoingOffline(true)
        try {
            await goOffline(roomId)
            onOffline()
            onClose()
        } catch {
            toast.error('Failed to go offline')
            setGoingOffline(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md bg-zinc-950 border-white/10 flex flex-col p-0 gap-0"
                showCloseButton={false}
            >
                {/* Header */}
                <SheetHeader className="px-5 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-white text-base">Creator Studio</SheetTitle>
                            <p className="text-xs text-zinc-500 mt-0.5">{room?.title}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Listener count badge */}
                            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                                <span className="size-1.5 rounded-full bg-red-400 animate-pulse" />
                                {listenerCount} live
                            </span>
                            <Link to={`/rooms/${roomId}`} className="text-zinc-500 hover:text-white transition-colors" onClick={onClose}>
                                <ExternalLink className="size-4" />
                            </Link>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                                <X className="size-4" />
                            </button>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">

                    {/* Song search — Apple Music style */}
                    <div className="px-5 pt-4 pb-3">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Add Songs</p>
                        <Input
                            placeholder="Search songs or artists…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9 text-sm"
                        />
                    </div>

                    {/* Song list */}
                    <div className="px-5 space-y-0.5 max-h-64 overflow-y-auto">
                        {!songsLoaded ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 py-2">
                                    <Skeleton className="size-9 rounded-lg bg-white/5 flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3 w-3/4 bg-white/5" />
                                        <Skeleton className="h-2.5 w-1/2 bg-white/5" />
                                    </div>
                                </div>
                            ))
                        ) : filtered.length === 0 ? (
                            <p className="text-zinc-600 text-xs text-center py-4">No songs found</p>
                        ) : filtered.map(song => {
                            const added = inPlaylist(song._id)
                            return (
                                <button
                                    key={song._id}
                                    onClick={() => toggleSong(song)}
                                    className={cn(
                                        'w-full flex items-center gap-3 py-2 px-2 rounded-xl transition-all text-left group',
                                        added ? 'bg-white/5' : 'hover:bg-white/5'
                                    )}
                                >
                                    <div className="relative flex-shrink-0">
                                        <img src={song.imageUrl} alt={song.title} className="size-9 rounded-lg object-cover" />
                                        {added && (
                                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                <Check className="size-4 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn('text-sm font-medium truncate', added ? 'text-white' : 'text-zinc-300 group-hover:text-white')}>{song.title}</p>
                                        <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                                    </div>
                                    <div className={cn(
                                        'flex-shrink-0 size-6 rounded-full border flex items-center justify-center transition-all',
                                        added
                                            ? 'border-white/20 bg-white/10 text-white'
                                            : 'border-white/10 text-zinc-600 group-hover:border-white/20 group-hover:text-white'
                                    )}>
                                        {added ? <Check className="size-3" /> : <Plus className="size-3" />}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Current playlist */}
                    {playlist.length > 0 && (
                        <div className="px-5 mt-4 border-t border-white/5 pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    Playlist <span className="text-zinc-600 normal-case font-normal">({playlist.length})</span>
                                </p>
                            </div>
                            <div className="space-y-0.5">
                                {playlist.map((song, i) => (
                                    <div key={`${i}-${song._id}`} className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl group hover:bg-white/5">
                                        <GripVertical className="size-3.5 text-zinc-700 flex-shrink-0" />
                                        <span className="text-xs text-zinc-600 w-4 text-right tabular-nums flex-shrink-0">{i + 1}</span>
                                        <img src={song.imageUrl} alt={song.title} className="size-7 rounded-md object-cover flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-zinc-200 truncate">{song.title}</p>
                                            <p className="text-[10px] text-zinc-500 truncate">{song.artist}</p>
                                        </div>
                                        <button
                                            onClick={() => setPlaylist(prev => prev.filter((_, idx) => idx !== i))}
                                            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stream goal */}
                    <div className="px-5 mt-4 border-t border-white/5 pt-4 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Goal className="size-3.5 text-zinc-400" />
                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stream Goal</p>
                        </div>
                        {room && room.streamGoal > 0 && (
                            <div className="mb-3">
                                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                    <span>{room.streamGoalCurrent.toLocaleString()} coins raised</span>
                                    <span>{room.streamGoal.toLocaleString()} goal</span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-400 rounded-full transition-all"
                                        style={{ width: `${Math.min((room.streamGoalCurrent / room.streamGoal) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        <Input
                            type="number"
                            min="1"
                            placeholder="e.g. 1000 coins"
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-9 text-sm"
                        />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-white/5 flex-shrink-0 space-y-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-9 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Save Changes
                    </button>
                    <button
                        onClick={handleGoOffline}
                        disabled={goingOffline}
                        className="w-full h-9 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                        {goingOffline ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
                        Go Offline
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export const LeftSidebar = ({ isCollapsed }: LeftSidebarProps) => {
    const { user } = useUser()
    const { isAdmin } = useAuthStore()
    const { balance } = useWalletStore()
    const navigate = useNavigate()
    const socket = useSocialSocket()
    const [roomState, setRoomState] = useState<RoomState>('none')
    const [liveRoomId, setLiveRoomId] = useState<string | null>(null)
    const [liveRoom, setLiveRoom] = useState<RoomInfo | null>(null)
    const [listenerCount, setListenerCount] = useState(0)
    const [sheetOpen, setSheetOpen] = useState(false)
    const storeListenerCount = useRoomStore(s => s.listenerCount)
    const isCreator = useRoomStore(s => s.isCreator)
    const effectiveListenerCount = (roomState === 'live' && isCreator && storeListenerCount > 0)
        ? storeListenerCount
        : listenerCount

    useEffect(() => {
        axiosInstance.get('/rooms/me/room')
            .then(({ data }) => {
                const room = data.data
                if (!room) return
                setRoomState(room.status === 'live' ? 'live' : 'offline')
                if (room.status === 'live') {
                    setLiveRoomId(room._id)
                    setLiveRoom(room)
                    setListenerCount(room.listenerCount ?? 0)
                }
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!socket) return
        const onLive = ({ roomId }: { roomId: string }) => {
            setRoomState('live')
            setLiveRoomId(roomId)
            setListenerCount(0)
            // Refresh full room data for the sheet
            axiosInstance.get(`/rooms/${roomId}`).then(({ data }) => setLiveRoom(data.data)).catch(() => {})
        }
        const onOffline = () => { setRoomState('offline'); setLiveRoomId(null); setLiveRoom(null); setListenerCount(0) }
        socket.on('creator:room_live', onLive)
        socket.on('creator:room_offline', onOffline)
        return () => {
            socket.off('creator:room_live', onLive)
            socket.off('creator:room_offline', onOffline)
        }
    }, [socket])

    const handleGoLiveCta = () => {
        if (roomState === 'live' && liveRoomId) {
            setSheetOpen(true)   // open creator panel, not navigate to room
        } else {
            navigate('/creator') // go to creator setup page
        }
    }

    const ctaLabel = roomState === 'live' ? 'Live Now' : roomState === 'offline' ? 'Go Live' : 'Create Room'
    // Red when live (matching "on air" convention), blue when offline
    const ctaColor = roomState === 'live'
        ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
    const dotColor = roomState === 'live' ? 'bg-red-400' : undefined

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
                    {navItems.map(({ to, icon: Icon, label, isWallet }) => {
                        const isProfile = to === '/profile'
                        const badge = isWallet && balance > 0 ? `${balance.toLocaleString()} 🪙` : undefined

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

                        if (isProfile) {
                            return (
                                <Popover key={to}>
                                    <PopoverTrigger asChild>{linkEl}</PopoverTrigger>
                                    <PopoverContent side="right" sideOffset={12} className="p-0 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl">
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                {user?.imageUrl ? (
                                                    <img src={user.imageUrl} alt={user.fullName ?? 'User'} className="size-10 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                                        <User className="size-4 text-zinc-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{user?.fullName ?? 'User'}</p>
                                                    <p className="text-[11px] text-zinc-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {isAdmin && (
                                                    <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Admin</span>
                                                )}
                                                <span className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full">Free tier</span>
                                            </div>
                                            <div className="pt-2 border-t border-white/5">
                                                <Link to="/profile" className="block text-center text-[11px] font-semibold py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                                    View Profile
                                                </Link>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )
                        }

                        if (!isCollapsed) return linkEl

                        return (
                            <Tooltip key={to}>
                                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                                <TooltipContent side="right" sideOffset={12}>
                                    <span>{label}</span>
                                    {badge && <span className="ml-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{badge}</span>}
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
                                        ? <span className={cn('w-2 h-2 rounded-full animate-pulse', dotColor)} />
                                        : <Zap className='size-4' />
                                    }
                                </div>
                                {!isCollapsed && (
                                    <div className='flex flex-col pr-4'>
                                        <span className='text-sm font-semibold whitespace-nowrap leading-tight'>{ctaLabel}</span>
                                        {roomState === 'live' && effectiveListenerCount > 0 && (
                                            <span className='text-[10px] text-red-400/70 leading-tight'>
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

            {/* Creator Live Sheet */}
            {liveRoomId && (
                <CreatorLiveSheet
                    open={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    roomId={liveRoomId}
                    room={liveRoom}
                    onOffline={() => { setRoomState('offline'); setLiveRoomId(null); setLiveRoom(null) }}
                />
            )}
        </TooltipProvider>
    )
}
