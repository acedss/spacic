import { useEffect, useState, useRef, useCallback } from 'react'
import {
    Search, UserPlus, UserCheck, Clock, X, Check,
    Users, UserMinus, UserX, SendHorizontal, Inbox,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useFriendStore } from '@/stores/useFriendStore'
import type { FriendSearchResult, FriendRequest, Friend } from '@/types/types'
import TopBar from '@/components/TopBar'

// ── Pending action helper ─────────────────────────────────────────────────────
// Tracks per-user loading so buttons go into a spinner individually.

const usePending = () => {
    const [pending, setPending] = useState<Set<string>>(new Set())
    const start = (id: string) => setPending((s) => new Set(s).add(id))
    const stop  = (id: string) => setPending((s) => { const n = new Set(s); n.delete(id); return n })
    const has   = (id: string) => pending.has(id)
    return { start, stop, has }
}

// ── Search result card ────────────────────────────────────────────────────────

const SearchCard = ({ result }: { result: FriendSearchResult }) => {
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

// ── Request card ──────────────────────────────────────────────────────────────

const RequestCard = ({ request }: { request: FriendRequest }) => {
    const { acceptRequest, declineRequest } = useFriendStore()
    const { start, stop, has } = usePending()
    const accepting  = has(`accept-${request._id}`)
    const declining  = has(`decline-${request._id}`)

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

    const timeAgo = (iso: string) => {
        const diff = Date.now() - Date.parse(iso)
        const mins = Math.floor(diff / 60_000)
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.floor(hrs / 24)}d ago`
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

// ── Friend card ───────────────────────────────────────────────────────────────

const FriendCard = ({ friend }: { friend: Friend }) => {
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

// ── Sent request row ──────────────────────────────────────────────────────────

const SentRequestCard = ({ request }: { request: FriendRequest }) => {
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

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="size-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Icon className="size-6 text-zinc-600" />
        </div>
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">{sub}</p>
    </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

const FriendsPage = () => {
    const [query, setQuery] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const {
        friends, searchResults, searchLoading,
        requests, sentRequests, loading,
        searchUsers, clearSearch, fetchRequests, fetchFriends,
    } = useFriendStore()

    useEffect(() => {
        fetchRequests()
        fetchFriends()
    }, [fetchRequests, fetchFriends])

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!value.trim()) { clearSearch(); return }
        debounceRef.current = setTimeout(() => searchUsers(value), 350)
    }, [searchUsers, clearSearch])

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

    return (
        <div className="flex flex-col min-h-full bg-zinc-950 text-white">
            <TopBar />

            <div className="px-6 py-8 max-w-2xl mx-auto w-full">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
                    <p className="text-zinc-500 text-sm mt-1">Connect with people on Spacic.</p>

                    {/* Stats strip */}
                    <div className="flex items-center gap-4 mt-5">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                            <Users className="size-3.5 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-300">{friends.length}</span>
                            <span className="text-xs text-zinc-500">friends</span>
                        </div>
                        {requests.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Inbox className="size-3.5 text-blue-400" />
                                <span className="text-xs font-semibold text-blue-300">{requests.length}</span>
                                <span className="text-xs text-blue-400/70">incoming</span>
                            </div>
                        )}
                        {sentRequests.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <SendHorizontal className="size-3.5 text-yellow-400" />
                                <span className="text-xs font-semibold text-yellow-300">{sentRequests.length}</span>
                                <span className="text-xs text-yellow-400/70">pending</span>
                            </div>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="search">
                    <TabsList className="mb-6 bg-white/5 border border-white/5 h-10 w-full">
                        <TabsTrigger value="search" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500">
                            <Search className="size-3.5" />
                            Find People
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500">
                            <Inbox className="size-3.5" />
                            Requests
                            {requests.length > 0 && (
                                <Badge className="ml-1.5 bg-blue-500 text-white text-[9px] h-4 px-1.5 min-w-0 rounded-full">
                                    {requests.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="friends" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500">
                            <Users className="size-3.5" />
                            My Friends
                            {friends.length > 0 && (
                                <span className="ml-1.5 text-[10px] text-zinc-500">({friends.length})</span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Find People ──────────────────────────────────────── */}
                    <TabsContent value="search" className="space-y-4">

                        {/* Search input */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                            <Input
                                value={query}
                                onChange={(e) => handleQueryChange(e.target.value)}
                                placeholder="Search by name..."
                                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/40 rounded-xl"
                            />
                        </div>

                        {/* Loading */}
                        {searchLoading && (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                                        <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-36 bg-white/5" />
                                            <Skeleton className="h-3 w-24 bg-white/5" />
                                        </div>
                                        <Skeleton className="h-8 w-24 rounded-lg bg-white/5" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Results */}
                        {!searchLoading && searchResults.length > 0 && (
                            <div className="space-y-2">
                                {searchResults.map((r) => (
                                    <SearchCard key={r.userId} result={r} />
                                ))}
                            </div>
                        )}

                        {/* No results */}
                        {!searchLoading && query && searchResults.length === 0 && (
                            <EmptyState
                                icon={UserX}
                                title={`No results for "${query}"`}
                                sub="Try a different name. Only exact name matches are returned."
                            />
                        )}

                        {/* Idle — show sent requests if any */}
                        {!query && (
                            <>
                                {sentRequests.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-3">
                                            <SendHorizontal className="size-3.5 text-yellow-400" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
                                                Sent Requests
                                            </p>
                                        </div>
                                        {sentRequests.map((r) => (
                                            <SentRequestCard key={r._id} request={r} />
                                        ))}
                                        <Separator className="bg-white/5 mt-6 mb-2" />
                                    </div>
                                )}
                                <EmptyState
                                    icon={Search}
                                    title="Find your people"
                                    sub="Search by name to add friends and listen together in real-time."
                                />
                            </>
                        )}
                    </TabsContent>

                    {/* ── Requests ─────────────────────────────────────────── */}
                    <TabsContent value="requests" className="space-y-2">
                        {loading && (
                            <div className="space-y-2">
                                {[1, 2].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                                        <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-32 bg-white/5" />
                                            <Skeleton className="h-3 w-20 bg-white/5" />
                                        </div>
                                        <Skeleton className="h-8 w-20 rounded-lg bg-white/5" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && requests.length > 0 && (
                            <div className="space-y-2">
                                {requests.map((r) => <RequestCard key={r._id} request={r} />)}
                            </div>
                        )}

                        {!loading && requests.length === 0 && (
                            <EmptyState
                                icon={Inbox}
                                title="No pending requests"
                                sub="When someone sends you a friend request, it'll show up here."
                            />
                        )}
                    </TabsContent>

                    {/* ── My Friends ───────────────────────────────────────── */}
                    <TabsContent value="friends" className="space-y-2">
                        {loading && (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                                        <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                                        <Skeleton className="h-4 w-40 bg-white/5" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && friends.length > 0 && (
                            <div className="space-y-2">
                                {friends.map((f) => (
                                    <FriendCard key={f.userId} friend={f} />
                                ))}

                            </div>
                        )}

                        {!loading && friends.length === 0 && (
                            <EmptyState
                                icon={Users}
                                title="No friends yet"
                                sub="Use the Find People tab to search for people and send them a request."
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

export default FriendsPage
