import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriendStore } from '@/stores/useFriendStore';
import { UserPublicProfileModal } from '@/pages/room/components/UserPublicProfileModal';
import { FriendsHeader } from './components/FriendsHeader';
import { FindPeopleTab } from './components/FindPeopleTab';
import { RequestsTab } from './components/RequestsTab';
import { MyFriendsTab } from './components/MyFriendsTab';

const FriendsPage = () => {
    const [searchParams] = useSearchParams();
    const [viewingUserId, setViewingUserId] = useState<string | null>(searchParams.get('user'));
    const { friends, requests, sentRequests, fetchRequests, fetchFriends } = useFriendStore();

    useEffect(() => {
        fetchRequests();
        fetchFriends();
    }, [fetchRequests, fetchFriends]);

    return (
        <div className="flex flex-col min-h-full bg-zinc-950 text-white">
            <div className="px-6 py-8 max-w-2xl mx-auto w-full">
                <FriendsHeader
                    friendsCount={friends.length}
                    requestsCount={requests.length}
                    sentCount={sentRequests.length}
                />

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

                    <TabsContent value="search"><FindPeopleTab /></TabsContent>
                    <TabsContent value="requests"><RequestsTab /></TabsContent>
                    <TabsContent value="friends"><MyFriendsTab /></TabsContent>
                </Tabs>
            </div>

            <UserPublicProfileModal
                userId={viewingUserId}
                userName=""
                imageUrl=""
                onClose={() => setViewingUserId(null)}
            />
        </div>
    );
};

export default FriendsPage;
