import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Bell, Share2, X, Radio, UserPlus, Users as UsersIcon, Zap, Clock } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { useFriendStore } from '@/stores/useFriendStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { useNotificationStore, type Notification } from '@/stores/useNotificationStore'
import type { FriendInvite, FriendActivityItem } from '@/types/types'

// ── Online dot ────────────────────────────────────────────────────────────────

const OnlineDot = ({ online }: { online: boolean }) => (
    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${
        online ? 'bg-[oklch(0.74_0.14_160)] border-[var(--ink-1)]' : 'bg-white/20 border-[var(--ink-1)]'
    }`} />
)

// ── Pending invite card ───────────────────────────────────────────────────────

const InviteCard = ({ invite }: { invite: FriendInvite }) => {
    const { dismissInvite } = useFriendStore()
    const navigate = useNavigate()
    const ttlMs = Math.max(0, Date.parse(invite.expiresAt) - Date.now())

    useEffect(() => {
        if (ttlMs <= 0) { dismissInvite(invite.inviteId); return; }
        const t = setTimeout(() => dismissInvite(invite.inviteId), ttlMs)
        return () => clearTimeout(t)
    }, [invite.inviteId, ttlMs, dismissInvite])

    return (
        <div className='bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2'>
            <div className='flex items-center gap-2'>
                <Avatar className='w-8 h-8 shrink-0'>
                    <AvatarImage src={invite.from.imageUrl} alt={invite.from.fullName} />
                    <AvatarFallback className='text-xs'>{invite.from.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className='flex-1 min-w-0'>
                    <p className='text-xs font-semibold truncate'>{invite.from.fullName}</p>
                    <p className='text-[10px] text-zinc-400 truncate'>
                        Invited you to <span className='text-white'>{invite.room.title}</span>
                    </p>
                </div>
                <button onClick={() => dismissInvite(invite.inviteId)} className='text-zinc-500 hover:text-zinc-300'>
                    <X className='size-3' />
                </button>
            </div>
            <button
                onClick={() => {
                    dismissInvite(invite.inviteId)
                    // ?ref= enables InviteLog tracking on RoomPage mount
                    navigate(`/rooms/${invite.room._id}?ref=${invite.from.userId}`)
                }}
                className='w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg transition-colors'
            >
                Join Room
            </button>
        </div>
    )
}

// ── Friend row (listening or online) ─────────────────────────────────────────

interface FriendRowProps {
    friend: FriendActivityItem
    listening: boolean
    currentRoomId?: string   // if the viewer is in a room, show Invite btn
    onInvite?: (friendId: string) => void
}

const listeningDuration = (joinedAt?: string) => {
    if (!joinedAt) return null
    const mins = Math.floor((Date.now() - Date.parse(joinedAt)) / 60000)
    if (mins < 1) return 'just joined'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const FriendRow = ({ friend, listening, currentRoomId, onInvite }: FriendRowProps) => {
    const navigate = useNavigate()
    const dur = listeningDuration(friend.joinedAt)

    return (
        <div className='flex items-center gap-3 py-2'>
            <div className='relative shrink-0'>
                <Avatar className='w-9 h-9'>
                    <AvatarImage src={friend.imageUrl} alt={friend.fullName} />
                    <AvatarFallback className='text-xs'>{friend.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <OnlineDot online />
            </div>

            <div className='flex-1 min-w-0'>
                <p className='text-[13px] text-white truncate'>{friend.fullName}</p>
                {friend.room ? (
                    <div>
                        <p className='text-[11px] truncate' style={{ color: 'var(--fg-3)' }}>
                            in <span className='text-white/80 serif italic'>{friend.room.title}</span>
                        </p>
                        {dur && (
                            <p className='text-[9px] flex items-center gap-1 mt-0.5' style={{ color: 'var(--fg-3)' }}>
                                <Clock className='size-2.5' /> {dur}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className='text-[11px]' style={{ color: 'var(--fg-3)' }}>Online</p>
                )}
            </div>

            {listening && friend.room && (
                <div className='flex flex-col items-end gap-1 shrink-0'>
                    <button
                        onClick={() => navigate(`/rooms/${friend.room!._id}?ref=${friend.userId}&type=activity_join`)}
                        className='h-7 px-2.5 text-[10px] font-semibold ring-1 ring-white/15 hover:bg-white/8 rounded-full press whitespace-nowrap text-white'
                    >
                        Join
                    </button>
                    <span className='text-[8px] mono' style={{ color: 'oklch(0.88 0.12 75)' }}>+5 coins</span>
                </div>
            )}

            {!listening && currentRoomId && onInvite && (
                <button
                    onClick={() => onInvite(friend.userId)}
                    className='shrink-0 h-7 w-7 rounded-lg grid place-items-center bg-[oklch(0.68_0.21_295_/_0.15)] text-[oklch(0.82_0.14_295)] ring-1 ring-[oklch(0.68_0.21_295_/_0.35)] press hover:bg-[oklch(0.68_0.21_295_/_0.25)]'
                    title={`Invite ${friend.fullName}`}
                >
                    <UserPlus className='size-3.5' />
                </button>
            )}
        </div>
    )
}

// ── Offline friend row ────────────────────────────────────────────────────────

const OfflineRow = ({ friend }: { friend: FriendActivityItem }) => (
    <div className='flex items-center gap-3 py-2 opacity-40'>
        <div className='relative shrink-0'>
            <Avatar className='w-10 h-10'>
                <AvatarImage src={friend.imageUrl} alt={friend.fullName} />
                <AvatarFallback className='text-xs'>{friend.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <OnlineDot online={false} />
        </div>
        <div className='min-w-0'>
            <p className='text-sm font-semibold truncate'>{friend.fullName}</p>
            <p className='text-[11px] text-zinc-500'>Offline</p>
        </div>
    </div>
)

// ── Main component ────────────────────────────────────────────────────────────

const NOTIF_ICONS: Record<string, string> = {
    friend_request: '👤',
    friend_accepted: '🤝',
    room_invite: '🎧',
    room_live: '🔴',
    system: '📢',
}

const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - Date.parse(date)) / 1000)
    if (d < 60) return 'just now'
    if (d < 3600) return `${Math.floor(d / 60)}m ago`
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`
    return `${Math.floor(d / 86400)}d ago`
}

export const FriendsActivity = () => {
    const { userId } = useAuth()
    const navigate = useNavigate()
    const socket     = useSocialSocket()
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { activity, pendingInvites, fetchActivity, addPendingInvite, sendInvite } = useFriendStore()
    const currentRoom = useRoomStore((s) => s.room)
    const liveRoomId = currentRoom?.status === 'live' ? currentRoom._id : undefined
    const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAllRead } = useNotificationStore()
    const [showNotifs, setShowNotifs] = useState(false)

    useEffect(() => { fetchActivity() }, [fetchActivity])
    useEffect(() => { if (userId) fetchUnreadCount() }, [userId, fetchUnreadCount])

    // Debounced refresh — collapses burst events into one fetch
    const debouncedFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchActivity(), 1500)
    }, [fetchActivity])

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }, [])

    const handleInvite = useCallback((invite: FriendInvite) => {
        addPendingInvite(invite)
        fetchUnreadCount()
        toast.info(`${invite.from.fullName} invited you to ${invite.room.title}`)
    }, [addPendingInvite, fetchUnreadCount])

    const handleRequestReceived = useCallback(() => {
        toast.info('You have a new friend request')
        fetchUnreadCount()
    }, [fetchUnreadCount])

    // Attach/detach listeners on the shared socket
    useEffect(() => {
        if (!socket || !userId) return

        socket.on('friend:invite',           handleInvite)
        socket.on('friend:request_received', handleRequestReceived)
        socket.on('friend:request_accepted', () => {
            debouncedFetch()
            fetchUnreadCount()
            toast.success('A friend request was accepted!')
        })
        socket.on('friend:activity_changed', debouncedFetch)
        socket.on('creator:room_live',       debouncedFetch)
        socket.on('creator:room_offline',    debouncedFetch)

        return () => {
            socket.off('friend:invite',           handleInvite)
            socket.off('friend:request_received', handleRequestReceived)
            socket.off('friend:request_accepted')
            socket.off('friend:activity_changed', debouncedFetch)
            socket.off('creator:room_live',       debouncedFetch)
            socket.off('creator:room_offline',    debouncedFetch)
        }
    }, [socket, userId, handleInvite, handleRequestReceived, debouncedFetch])

    // Copy the room link with ?ref=userId for referral analytics
    const handleCopyLink = () => {
        const base = window.location.origin
        const path = liveRoomId
            ? `/rooms/${liveRoomId}?ref=${userId}`
            : `/profile`
        navigator.clipboard.writeText(base + path)
        toast.success(liveRoomId ? 'Room invite link copied!' : 'Profile link copied!')
    }

    const { listening, online, offline } = activity

    // Split listening friends: same room vs other rooms
    const coListening = listening.filter((f) => liveRoomId && f.room?._id === liveRoomId)
    const otherRooms  = listening.filter((f) => !liveRoomId || f.room?._id !== liveRoomId)

    // Online friends already in our room should NOT get an invite button
    const invitableOnline = online.filter(
        (f) => !listening.some((l) => l.userId === f.userId)
    )

    const hasActivity = listening.length > 0 || online.length > 0 || offline.length > 0

    return (
        <div className='flex flex-col h-full' style={{ background: 'var(--ink-1)' }}>

            {/* Header */}
            <div className='px-5 py-4 border-b hair flex items-center justify-between shrink-0'>
                <div>
                    <span className='mono text-[9px] uppercase tracking-widest block mb-0.5' style={{ color: 'var(--fg-3)' }}>Your circle</span>
                    <h3 className='serif italic text-[18px] text-white leading-tight'>Friends</h3>
                </div>
                <button
                    className='relative p-1.5 rounded-lg hover:bg-white/8 transition-colors'
                    onClick={() => {
                        setShowNotifs(!showNotifs)
                        if (!showNotifs) { fetchNotifications(); markAllRead() }
                    }}
                >
                    <Bell className='size-4' style={{ color: showNotifs ? 'var(--fg-1)' : 'var(--fg-3)' }} />
                    {unreadCount > 0 && (
                        <span className='absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notification dropdown */}
            {showNotifs && (
                <div className='border-b hair max-h-72 overflow-y-auto'>
                    <div className='px-4 py-2 flex items-center justify-between'>
                        <p className='text-[9px] font-bold uppercase tracking-widest' style={{ color: 'var(--fg-3)' }}>Notifications</p>
                        <button onClick={() => setShowNotifs(false)} className='text-zinc-500 hover:text-zinc-300'>
                            <X className='size-3' />
                        </button>
                    </div>
                    {notifications.length === 0 ? (
                        <p className='px-4 pb-4 text-[11px]' style={{ color: 'var(--fg-3)' }}>No notifications yet.</p>
                    ) : (
                        <div className='px-3 pb-3 space-y-1'>
                            {notifications.map((n: Notification) => (
                                <div
                                    key={n._id}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors ${
                                        n.read ? 'opacity-50' : 'bg-white/5'
                                    }`}
                                >
                                    <span className='text-sm mt-0.5 shrink-0'>{NOTIF_ICONS[n.type] ?? '📢'}</span>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-[11px] font-semibold text-white truncate'>{n.title}</p>
                                        <p className='text-[10px] truncate' style={{ color: 'var(--fg-3)' }}>{n.message}</p>
                                        <p className='text-[9px] mt-0.5' style={{ color: 'var(--fg-3)' }}>{timeAgo(n.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className='flex-1 overflow-y-auto px-4 py-4 space-y-1'>

                {/* Pending invites */}
                {pendingInvites.length > 0 && (
                    <div className='space-y-2 pb-3'>
                        {pendingInvites.map((invite) => (
                            <InviteCard key={invite.inviteId} invite={invite} />
                        ))}
                    </div>
                )}

                {/* Co-listening: friends in the SAME room as me */}
                {coListening.length > 0 && (
                    <div className='mb-3'>
                        <div className='flex items-center gap-1.5 mb-2 px-1'>
                            <span className='w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse' />
                            <p className='text-[9px] font-bold uppercase tracking-widest text-green-400'>
                                Co-listening with you
                            </p>
                        </div>
                        <div className='bg-green-500/5 border border-green-500/15 rounded-xl px-3 py-1 divide-y divide-white/5'>
                            {coListening.map((f) => (
                                <div key={f.userId} className='flex items-center gap-3 py-2'>
                                    <div className='relative shrink-0'>
                                        <Avatar className='w-9 h-9'>
                                            <AvatarImage src={f.imageUrl} alt={f.fullName} />
                                            <AvatarFallback className='text-xs'>{f.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className='absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 bg-green-400 animate-pulse' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs font-semibold truncate'>{f.fullName}</p>
                                        <p className='text-[10px] text-green-400'>In this room</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Friends in other rooms */}
                {otherRooms.map((f) => (
                    <FriendRow key={f.userId} friend={f} listening />
                ))}

                {/* Online — show invite btn only if I'm live and they're not already in my room */}
                {invitableOnline.map((f) => (
                    <FriendRow
                        key={f.userId}
                        friend={f}
                        listening={false}
                        currentRoomId={liveRoomId}
                        onInvite={(friendId) => sendInvite(friendId, liveRoomId!)}
                    />
                ))}

                {/* Offline */}
                {offline.map((f) => (
                    <OfflineRow key={f.userId} friend={f} />
                ))}

                {/* Empty state */}
                {!hasActivity && pendingInvites.length === 0 && (
                    <div className='flex flex-col items-center gap-3 py-12 text-center'>
                        <Radio className='size-8 opacity-20 text-white' />
                        <p className='text-[11px] leading-relaxed' style={{ color: 'var(--fg-3)' }}>
                            No friends active right now.<br />
                            Add friends to see their activity.
                        </p>
                    </div>
                )}

                {/* Grow Community — always at bottom */}
                <div className='pt-4 mt-2 border-t border-white/5'>
                    <div className='p-3 rounded-xl bg-white/5 space-y-2'>
                        <p className='text-[9px] font-bold uppercase tracking-widest text-zinc-500'>
                            Grow Community
                        </p>
                        <p className='text-[10px] text-zinc-500 leading-relaxed'>
                            {liveRoomId
                                ? 'Share your room link to invite listeners.'
                                : 'Share your profile link to earn bonus coins.'}
                        </p>
                        <button
                            onClick={handleCopyLink}
                            className='w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-semibold transition-all'
                        >
                            <Share2 className='size-3.5' />
                            {liveRoomId ? 'Copy Room Link' : 'Copy Profile Link'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
