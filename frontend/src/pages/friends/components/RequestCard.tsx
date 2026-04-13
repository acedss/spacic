import { Clock, Check, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useFriendStore } from '@/stores/useFriendStore'
import type { FriendRequest } from '@/types/types'
import { usePending } from './usePending'

const timeAgo = (iso: string) => {
    const diff = Date.now() - Date.parse(iso)
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

export const RequestCard = ({ request }: { request: FriendRequest }) => {
    const { acceptRequest, declineRequest } = useFriendStore()
    const { start, stop, has } = usePending()
    const accepting = has(`accept-${request._id}`)
    const declining = has(`decline-${request._id}`)

    const handleAccept = async () => {
        start(`accept-${request._id}`)
        await acceptRequest(request._id)
        stop(`accept-${request._id}`)
    }

    const handleDecline = async () => {
        start(`decline-${request._id}`)
        await declineRequest(request._id)
        stop(`decline-${request._id}`)
    }

    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-blue-500/20 hover:bg-blue-500/[0.03] transition-all">
            <Avatar className="w-12 h-12 ring-2 ring-blue-500/20 shrink-0">
                <AvatarImage src={request.requester.imageUrl} alt={request.requester.fullName} />
                <AvatarFallback className="bg-zinc-800 text-sm font-bold">
                    {request.requester.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{request.requester.fullName}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Sent a request · {timeAgo(request.createdAt)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
                <Button
                    size="sm"
                    onClick={handleAccept}
                    disabled={accepting || declining}
                    className="h-8 text-xs bg-blue-500 hover:bg-blue-600"
                >
                    {accepting ? <Clock className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Accept
                </Button>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleDecline}
                    disabled={declining || accepting}
                    className="h-8 w-8 bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-zinc-500"
                >
                    {declining ? <Clock className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                </Button>
            </div>
        </div>
    )
}
