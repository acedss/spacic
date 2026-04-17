import { Clock, UserX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useFriendStore } from '@/stores/useFriendStore'
import type { Friend } from '@/types/types'
import { usePending } from './usePending'

export const FriendCard = ({ friend }: { friend: Friend }) => {
    const { unfriend } = useFriendStore()
    const { start, stop, has } = usePending()
    const loading = has(friend.userId)

    const handleUnfriend = async () => {
        start(friend.userId)
        await unfriend(friend.friendshipId, friend.userId)
        stop(friend.userId)
    }

    return (
        <div className="group flex items-center gap-4 p-4 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-white/10 transition-all">
            <Avatar className="w-12 h-12 ring-2 ring-white/5 shrink-0">
                <AvatarImage src={friend.imageUrl} alt={friend.fullName} />
                <AvatarFallback className="bg-zinc-800 text-sm font-bold">
                    {friend.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{friend.fullName}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Friend</p>
            </div>
            <Button
                size="sm"
                variant="ghost"
                onClick={handleUnfriend}
                disabled={loading}
                className="h-8 text-xs opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all"
            >
                {loading
                    ? <Clock className="size-3.5 animate-spin" />
                    : <UserX className="size-3.5" />
                }
                Unfriend
            </Button>
        </div>
    )
}
