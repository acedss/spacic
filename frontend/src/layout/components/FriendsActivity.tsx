import { useEffect, useRef, useCallback } from 'react'
import { Bell, Share2, X, Radio, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { useFriendStore } from '@/stores/useFriendStore'
import { useRoomStore } from '@/stores/useRoomStore'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import type { FriendInvite, FriendActivityItem } from '@/types/types'

// ── Online dot ────────────────────────────────────────────────────────────────

const OnlineDot = ({ online }: { online: boolean }) => (
    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
        online ? 'bg-green-500' : 'bg-zinc-600'
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

const FriendRow = ({ friend, listening, currentRoomId, onInvite }: FriendRowProps) => {
    const navigate = useNavigate()

    return (
        <div className='flex items-center gap-3 py-2'>
            <div className='relative shrink-0'>
                <Avatar className='w-10 h-10'>
                    <AvatarImage src={friend.imageUrl} alt={friend.fullName} />
                    <AvatarFallback className='text-xs'>{friend.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <OnlineDot online />
            </div>

            <div className='flex-1 min-w-0'>
                <p className='text-sm font-semibold truncate'>{friend.fullName}</p>
                {friend.room ? (
                    <p className='text-[11px] text-zinc-400 truncate'>
                        Listening to <span className='text-zinc-200'>{friend.room.title}</span>
                    </p>
                ) : (
                    <p className='text-[11px] text-zinc-400'>Online</p>
                )}
            </div>

            {/* Join Room — ref=friend.userId logs as 'activity_join' in InviteLog */}
            {listening && friend.room && (
                <button
                    onClick={() => navigate(`/rooms/${friend.room!._id}?ref=${friend.userId}&type=activity_join`)}
                    className='shrink-0 px-2.5 py-1 text-[10px] font-semibold border border-white/20 hover:bg-white/10 rounded-full transition-colors whitespace-nowrap'
                >
                    Join Room
                </button>
            )}

            {/* Invite — if viewer is in a room and this friend is only online (not already in a room) */}
            {!listening && currentRoomId && onInvite && (
                <button
                    onClick={() => onInvite(friend.userId)}
                    className='shrink-0 p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors'
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

export const FriendsActivity = () => {
    const { userId } = useAuth()
    const socket     = useSocialSocket()
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { activity, pendingInvites, fetchActivity, addPendingInvite, sendInvite } = useFriendStore()
    const currentRoom = useRoomStore((s) => s.room)
    const liveRoomId = currentRoom?.status === 'live' ? currentRoom._id : undefined

    useEffect(() => { fetchActivity() }, [fetchActivity])

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
        toast.info(`${invite.from.fullName} invited you to ${invite.room.title}`)
    }, [addPendingInvite])

    const handleRequestReceived = useCallback(() => {
        toast.info('You have a new friend request')
    }, [])

    // Attach/detach listeners on the shared socket
    useEffect(() => {
        if (!socket || !userId) return

        socket.on('friend:invite',           handleInvite)
        socket.on('friend:request_received', handleRequestReceived)
        socket.on('friend:request_accepted', () => {
            debouncedFetch()
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
        <div className='flex flex-col h-full'>

            {/* Header */}
            <div className='px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0'>
                <h3 className='font-bold text-sm tracking-tight'>Friends Activity</h3>
                <Bell className='size-4 text-zinc-500' />
            </div>

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
                        <Radio className='size-8 text-zinc-700' />
                        <p className='text-[11px] text-zinc-500 leading-relaxed'>
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
