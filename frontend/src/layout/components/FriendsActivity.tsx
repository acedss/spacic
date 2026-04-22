import { useEffect, useRef, useCallback, useState } from 'react'
import { Bell, Link2, X, Radio, UserPlus, Clock, Check } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNavigate } from 'react-router-dom'
import { UserHoverCard } from '@/components/UserHoverCard'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { useFriendStore } from '@/stores/useFriendStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { useNotificationStore, type Notification } from '@/stores/useNotificationStore'
import type { FriendInvite, FriendActivityItem } from '@/types/types'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const OnlineDot = ({ online }: { online: boolean }) => (
    <span className={cn(
        'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--ink-1)]',
        online ? 'bg-[oklch(0.74_0.14_160)]' : 'bg-white/20'
    )} />
)

const listeningDuration = (joinedAt?: string) => {
    if (!joinedAt) return null
    const mins = Math.floor((Date.now() - Date.parse(joinedAt)) / 60000)
    if (mins < 1) return 'just joined'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - Date.parse(date)) / 1000)
    if (d < 60) return 'just now'
    if (d < 3600) return `${Math.floor(d / 60)}m ago`
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`
    return `${Math.floor(d / 86400)}d ago`
}

// ── Pending invite card ───────────────────────────────────────────────────────

const InviteCard = ({ invite }: { invite: FriendInvite }) => {
    const { dismissInvite } = useFriendStore()
    const navigate = useNavigate()

    useEffect(() => {
        const ttlMs = Math.max(0, Date.parse(invite.expiresAt) - Date.now())
        if (ttlMs <= 0) { dismissInvite(invite.inviteId); return; }
        const t = setTimeout(() => dismissInvite(invite.inviteId), ttlMs)
        return () => clearTimeout(t)
    }, [invite.inviteId, invite.expiresAt, dismissInvite])

    return (
        <div className="rounded-xl p-3 space-y-2.5 ring-1 ring-[oklch(0.68_0.21_295_/_0.3)] bg-[oklch(0.68_0.21_295_/_0.06)]">
            <div className="flex items-center gap-2.5">
                <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={invite.from.imageUrl} />
                    <AvatarFallback className="text-[10px]">{invite.from.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{invite.from.fullName}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>
                        Invited you · <span className="text-white/70 serif italic">{invite.room.title}</span>
                    </p>
                </div>
                <button onClick={() => dismissInvite(invite.inviteId)} className="p-1 rounded hover:bg-white/8" style={{ color: 'var(--fg-3)' }}>
                    <X className="size-3" />
                </button>
            </div>
            <button
                onClick={() => { dismissInvite(invite.inviteId); navigate(`/rooms/${invite.room._id}?ref=${invite.from.userId}`) }}
                className="w-full h-8 rounded-xl bg-[oklch(0.68_0.21_295)] text-white text-[12px] font-semibold press">
                Join Room
            </button>
        </div>
    )
}

// ── Friend row ────────────────────────────────────────────────────────────────

const FriendRow = ({ friend, listening, currentRoomId, onInvite }: {
    friend: FriendActivityItem
    listening: boolean
    currentRoomId?: string
    onInvite?: (friendId: string) => void
}) => {
    const navigate = useNavigate()
    const dur = listeningDuration(friend.joinedAt)

    return (
        <div className="flex items-center gap-3 py-2.5 px-1">
            <UserHoverCard userId={friend.userId} userName={friend.fullName} imageUrl={friend.imageUrl} side="left">
                <button className="relative shrink-0 press">
                    <Avatar className="w-8 h-8">
                        <AvatarImage src={friend.imageUrl} />
                        <AvatarFallback className="text-[10px]">{friend.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <OnlineDot online />
                </button>
            </UserHoverCard>

            <div className="flex-1 min-w-0">
                <UserHoverCard userId={friend.userId} userName={friend.fullName} imageUrl={friend.imageUrl} side="left">
                    <button className="text-left w-full min-w-0">
                        <p className="text-[13px] text-white truncate leading-tight hover:underline">{friend.fullName}</p>
                        {friend.room ? (
                            <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--fg-3)' }}>
                                in <span className="serif italic text-white/70">{friend.room.title}</span>
                                {dur && <span className="ml-1 opacity-60"><Clock className="size-2.5 inline -mt-0.5 mr-0.5" />{dur}</span>}
                            </p>
                        ) : (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Online</p>
                        )}
                    </button>
                </UserHoverCard>
            </div>

            {listening && friend.room && (
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <button
                        onClick={() => navigate(`/rooms/${friend.room!._id}?ref=${friend.userId}&type=activity_join`)}
                        className="h-7 px-2.5 text-[10px] font-semibold ring-1 ring-white/15 hover:bg-white/8 rounded-full press text-white whitespace-nowrap">
                        Join
                    </button>
                    <span className="text-[8px] mono" style={{ color: 'oklch(0.88 0.12 75)' }}>+5 coins</span>
                </div>
            )}

            {!listening && currentRoomId && onInvite && (
                <button onClick={() => onInvite(friend.userId)}
                    className="shrink-0 h-7 w-7 rounded-lg grid place-items-center bg-[oklch(0.68_0.21_295_/_0.12)] text-[oklch(0.82_0.14_295)] ring-1 ring-[oklch(0.68_0.21_295_/_0.3)] press hover:bg-[oklch(0.68_0.21_295_/_0.22)]"
                    title={`Invite ${friend.fullName}`}>
                    <UserPlus className="size-3.5" />
                </button>
            )}
        </div>
    )
}

// ── Offline row ───────────────────────────────────────────────────────────────

const OfflineRow = ({ friend }: { friend: FriendActivityItem }) => (
    <div className="flex items-center gap-3 py-2.5 px-1 opacity-40">
        <UserHoverCard userId={friend.userId} userName={friend.fullName} imageUrl={friend.imageUrl} side="left">
            <button className="relative shrink-0 press">
                <Avatar className="w-8 h-8">
                    <AvatarImage src={friend.imageUrl} />
                    <AvatarFallback className="text-[10px]">{friend.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <OnlineDot online={false} />
            </button>
        </UserHoverCard>
        <UserHoverCard userId={friend.userId} userName={friend.fullName} imageUrl={friend.imageUrl} side="left">
            <button className="text-left min-w-0">
                <p className="text-[13px] text-white truncate leading-tight hover:underline">{friend.fullName}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>Offline</p>
            </button>
        </UserHoverCard>
    </div>
)

// ── Section label ─────────────────────────────────────────────────────────────

const SectionLabel = ({ children, dot }: { children: React.ReactNode; dot?: string }) => (
    <div className="flex items-center gap-1.5 px-1 mb-1 mt-3 first:mt-0">
        {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />}
        <p className="mono text-[8px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>{children}</p>
    </div>
)

// ── Notification icons ────────────────────────────────────────────────────────

const NOTIF_ICONS: Record<string, string> = {
    friend_request: '👤', friend_accepted: '🤝',
    room_invite: '🎧', room_live: '🔴', system: '📢',
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const FriendsActivity = () => {
    const { userId } = useAuth()
    const socket      = useSocialSocket()
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { activity, pendingInvites, fetchActivity, addPendingInvite, sendInvite } = useFriendStore()
    const currentRoom = useRoomStore(s => s.room)
    const liveRoomId  = currentRoom?.status === 'live' ? currentRoom._id : undefined
    const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAllRead } = useNotificationStore()
    const [showNotifs, setShowNotifs] = useState(false)
    const [copied, setCopied]         = useState(false)

    useEffect(() => { fetchActivity() }, [fetchActivity])
    useEffect(() => { if (userId) fetchUnreadCount() }, [userId, fetchUnreadCount])

    const debouncedFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchActivity(), 1500)
    }, [fetchActivity])

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

    const handleInvite = useCallback((invite: FriendInvite) => {
        addPendingInvite(invite)
        fetchUnreadCount()
        toast.info(`${invite.from.fullName} invited you to ${invite.room.title}`)
    }, [addPendingInvite, fetchUnreadCount])

    const handleRequestReceived = useCallback(() => {
        toast.info('You have a new friend request')
        fetchUnreadCount()
    }, [fetchUnreadCount])

    useEffect(() => {
        if (!socket || !userId) return
        socket.on('friend:invite',           handleInvite)
        socket.on('friend:request_received', handleRequestReceived)
        socket.on('friend:request_accepted', () => { debouncedFetch(); fetchUnreadCount(); toast.success('A friend request was accepted!') })
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
    }, [socket, userId, handleInvite, handleRequestReceived, debouncedFetch, fetchUnreadCount])

    const handleCopyLink = () => {
        const base = window.location.origin
        const path = liveRoomId ? `/rooms/${liveRoomId}?ref=${userId}` : `/profile`
        navigator.clipboard.writeText(base + path).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success(liveRoomId ? 'Room invite link copied!' : 'Profile link copied!')
    }

    const { listening, online, offline } = activity
    const coListening     = listening.filter(f => liveRoomId && f.room?._id === liveRoomId)
    const otherRooms      = listening.filter(f => !liveRoomId || f.room?._id !== liveRoomId)
    const invitableOnline = online.filter(f => !listening.some(l => l.userId === f.userId))
    const hasActivity     = listening.length > 0 || online.length > 0 || offline.length > 0

    const onlineCount = listening.length + online.length

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--ink-1)' }}>

            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b hair flex items-center justify-between shrink-0">
                <div>
                    <span className="mono text-[8px] uppercase tracking-widest block mb-0.5" style={{ color: 'var(--fg-3)' }}>Your circle</span>
                    <div className="flex items-center gap-2">
                        <h3 className="serif italic text-[18px] text-white leading-tight">Friends</h3>
                        {onlineCount > 0 && (
                            <span className="mono text-[9px] px-1.5 py-0.5 rounded-full bg-[oklch(0.74_0.14_160_/_0.15)] text-[oklch(0.74_0.14_160)] ring-1 ring-[oklch(0.74_0.14_160_/_0.3)]">
                                {onlineCount} online
                            </span>
                        )}
                    </div>
                </div>
                <button
                    className="relative p-1.5 rounded-lg hover:bg-white/8 transition-colors"
                    onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) { fetchNotifications(); markAllRead() } }}>
                    <Bell className="size-4" style={{ color: showNotifs ? 'var(--fg-1)' : 'var(--fg-3)' }} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 flex items-center justify-center rounded-full bg-[oklch(0.72_0.22_20)] text-[8px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notification drawer */}
            {showNotifs && (
                <div className="border-b hair max-h-64 overflow-y-auto hide-scrollbar" style={{ background: 'var(--ink-2)' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                        <p className="mono text-[8px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Notifications</p>
                        <button onClick={() => setShowNotifs(false)} style={{ color: 'var(--fg-3)' }}>
                            <X className="size-3" />
                        </button>
                    </div>
                    {notifications.length === 0 ? (
                        <p className="px-4 pb-4 text-[11px]" style={{ color: 'var(--fg-3)' }}>No notifications yet.</p>
                    ) : (
                        <div className="px-3 pb-3 space-y-0.5">
                            {notifications.map((n: Notification) => (
                                <div key={n._id} className={cn('flex items-start gap-2.5 p-2.5 rounded-lg', n.read ? 'opacity-40' : 'bg-white/5')}>
                                    <span className="text-sm mt-0.5 shrink-0">{NOTIF_ICONS[n.type] ?? '📢'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold text-white truncate">{n.title}</p>
                                        <p className="text-[10px] truncate" style={{ color: 'var(--fg-3)' }}>{n.message}</p>
                                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{timeAgo(n.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-3 py-3 hide-scrollbar space-y-0.5">

                {/* Pending invites */}
                {pendingInvites.length > 0 && (
                    <div className="space-y-2 pb-2">
                        {pendingInvites.map(invite => <InviteCard key={invite.inviteId} invite={invite} />)}
                    </div>
                )}

                {/* Co-listening (same room) */}
                {coListening.length > 0 && (
                    <>
                        <SectionLabel dot="oklch(0.74 0.14 160)">Co-listening with you</SectionLabel>
                        <div className="rounded-xl ring-1 ring-[oklch(0.74_0.14_160_/_0.2)] bg-[oklch(0.74_0.14_160_/_0.05)] px-2 divide-y divide-white/5">
                            {coListening.map(f => (
                                <div key={f.userId} className="flex items-center gap-3 py-2.5">
                                    <UserHoverCard userId={f.userId} userName={f.fullName} imageUrl={f.imageUrl} side="left">
                                        <button className="relative shrink-0 press">
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={f.imageUrl} />
                                                <AvatarFallback className="text-[10px]">{f.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--ink-1)] bg-[oklch(0.74_0.14_160)] animate-pulse" />
                                        </button>
                                    </UserHoverCard>
                                    <div className="flex-1 min-w-0">
                                        <UserHoverCard userId={f.userId} userName={f.fullName} imageUrl={f.imageUrl} side="left">
                                            <button className="text-left w-full">
                                                <p className="text-[12px] text-white truncate hover:underline">{f.fullName}</p>
                                                <p className="text-[10px] text-[oklch(0.74_0.14_160)]">In this room</p>
                                            </button>
                                        </UserHoverCard>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Friends in other rooms */}
                {otherRooms.length > 0 && (
                    <>
                        <SectionLabel dot="oklch(0.68 0.21 295)">Listening now</SectionLabel>
                        {otherRooms.map(f => <FriendRow key={f.userId} friend={f} listening />)}
                    </>
                )}

                {/* Online (invitable) */}
                {invitableOnline.length > 0 && (
                    <>
                        <SectionLabel>Online</SectionLabel>
                        {invitableOnline.map(f => (
                            <FriendRow key={f.userId} friend={f} listening={false}
                                currentRoomId={liveRoomId} onInvite={id => sendInvite(id, liveRoomId!)} />
                        ))}
                    </>
                )}

                {/* Offline */}
                {offline.length > 0 && (
                    <>
                        <SectionLabel>Offline</SectionLabel>
                        {offline.map(f => <OfflineRow key={f.userId} friend={f} />)}
                    </>
                )}

                {/* Empty */}
                {!hasActivity && pendingInvites.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Radio className="size-7 opacity-15 text-white" />
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg-3)' }}>
                            No friends active right now.<br />Add friends to see their activity.
                        </p>
                    </div>
                )}

                {/* Grow Community */}
                <div className="pt-4 mt-2 border-t border-white/5">
                    <div className="p-3 rounded-xl bg-white/4 ring-1 ring-white/8 space-y-2">
                        <p className="mono text-[8px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Grow Community</p>
                        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--fg-3)' }}>
                            {liveRoomId ? 'Share your room link to invite listeners.' : 'Share your profile link to earn bonus coins.'}
                        </p>
                        <button onClick={handleCopyLink}
                            className="w-full flex items-center justify-center gap-2 h-8 bg-white/8 hover:bg-white/14 rounded-lg text-[11px] font-semibold press transition-all text-white">
                            {copied ? <Check className="size-3.5 text-[oklch(0.74_0.14_160)]" /> : <Link2 className="size-3.5" />}
                            {copied ? 'Copied!' : liveRoomId ? 'Copy Room Link' : 'Copy Profile Link'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    )
}
