import { useEffect, useState, useRef, useCallback } from 'react'
import {
    Search, Users, SendHorizontal, Inbox,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useFriendStore } from '@/stores/useFriendStore'
import TopBar from '@/components/TopBar'
import { SearchCard } from './components/SearchCard'
import { RequestCard } from './components/RequestCard'
import { FriendCard } from './components/FriendCard'
import { SentRequestCard } from './components/SentRequestCard'
import { EmptyState } from './components/EmptyState'

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
                                icon={Search}
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
