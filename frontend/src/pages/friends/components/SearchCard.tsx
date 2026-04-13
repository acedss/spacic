import { UserPlus, UserCheck, UserMinus, Clock, Check, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFriendStore } from '@/stores/useFriendStore'
import type { FriendSearchResult } from '@/types/types'
import { usePending } from './usePending'

export const SearchCard = ({ result }: { result: FriendSearchResult }) => {
    const { sendRequest, acceptRequest, cancelRequest, unfriend } = useFriendStore()
    const { start, stop, has } = usePending()
    const loading = has(result.userId)

    const handleSend = async () => {
        start(result.userId)
        await sendRequest(result.userId)
        stop(result.userId)
    }

    const handleAccept = async () => {
        if (!result.friendshipId) return
        start(result.userId)
        await acceptRequest(result.friendshipId)
        stop(result.userId)
    }

    const handleCancel = async () => {
        if (!result.friendshipId) return
        start(result.userId)
        await cancelRequest(result.friendshipId, result.userId)
        stop(result.userId)
    }

    const handleUnfriend = async () => {
        if (!result.friendshipId) return
        start(result.userId)
        await unfriend(result.friendshipId, result.userId)
        stop(result.userId)
    }

    const action = () => {
        switch (result.friendshipStatus) {
            case 'none':
                return (
                    <Button
                        size="sm"
                        onClick={handleSend}
                        disabled={loading}
                        className="h-8 text-xs bg-blue-500 hover:bg-blue-600 shrink-0"
                    >
                        {loading ? <Clock className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                        Add Friend
                    </Button>
                )
            case 'pending_sent':
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={loading}
                        className="h-8 text-xs bg-yellow-500/10 hover:bg-red-500/15 text-yellow-400 hover:text-red-400 border border-yellow-500/20 hover:border-red-500/20 transition-colors group shrink-0"
                    >
                        {loading
                            ? <Clock className="size-3.5 animate-spin" />
                            : <>
                                <Clock className="size-3.5 group-hover:hidden" />
                                <X className="size-3.5 hidden group-hover:block" />
                            </>
                        }
                        <span className="group-hover:hidden">Pending</span>
                        <span className="hidden group-hover:inline">Cancel</span>
                    </Button>
                )
            case 'pending_received':
                return (
                    <Button
                        size="sm"
                        onClick={handleAccept}
                        disabled={loading}
                        className="h-8 text-xs bg-green-500 hover:bg-green-600 shrink-0"
                    >
                        {loading ? <Clock className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Accept
                    </Button>
                )
            case 'accepted':
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleUnfriend}
                        disabled={loading}
                        className="h-8 text-xs bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-colors group shrink-0"
                    >
                        {loading
                            ? <Clock className="size-3.5 animate-spin" />
                            : <>
                                <UserCheck className="size-3.5 group-hover:hidden" />
                                <UserMinus className="size-3.5 hidden group-hover:block" />
                            </>
                        }
                        <span className="group-hover:hidden">Friends</span>
                        <span className="hidden group-hover:inline">Unfriend</span>
                    </Button>
                )
        }
    }

    return (
        <div className={cn(
            'group flex items-center gap-4 p-4 rounded-2xl border transition-all',
            'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10',
        )}>
            <div className="relative shrink-0">
                <Avatar className="w-12 h-12 ring-2 ring-white/5 group-hover:ring-white/10 transition-all">
                    <AvatarImage src={result.imageUrl} alt={result.fullName} />
                    <AvatarFallback className="bg-zinc-800 text-sm font-bold">
                        {result.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                {result.friendshipStatus === 'accepted' && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-green-500 border-2 border-zinc-950 flex items-center justify-center">
                        <UserCheck className="size-2 text-white" />
                    </span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{result.fullName}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {result.username
                        ? <span className="text-purple-400/80">@{result.username}</span>
                        : (
                            <>
                                {result.friendshipStatus === 'accepted' && 'Already friends'}
                                {result.friendshipStatus === 'pending_sent' && 'Request sent'}
                                {result.friendshipStatus === 'pending_received' && 'Wants to connect'}
                                {result.friendshipStatus === 'none' && 'Member of Spacic'}
                            </>
                        )
                    }
                </p>
            </div>
            {action()}
        </div>
    )
}
