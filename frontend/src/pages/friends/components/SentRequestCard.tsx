import { Clock, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useFriendStore } from '@/stores/useFriendStore'
import type { FriendRequest } from '@/types/types'
import { usePending } from './usePending'

export const SentRequestCard = ({ request }: { request: FriendRequest }) => {
    const { cancelRequest } = useFriendStore()
    const { start, stop, has } = usePending()
    const loading = has(request._id)

    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl border bg-yellow-500/[0.03] border-yellow-500/10">
            <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={request.recipient.imageUrl} alt={request.recipient.fullName} />
                <AvatarFallback className="bg-zinc-800 text-xs font-bold">
                    {request.recipient.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{request.recipient.fullName}</p>
                <p className="text-xs text-yellow-500/70 mt-0.5">Awaiting response</p>
            </div>
            <Button
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={async () => {
                    start(request._id)
                    await cancelRequest(request._id, request.recipient.userId)
                    stop(request._id)
                }}
                className="h-7 text-[11px] text-zinc-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 shrink-0"
            >
                {loading ? <Clock className="size-3 animate-spin" /> : <X className="size-3" />}
                Cancel
            </Button>
        </div>
    )
}
