import { Users } from 'lucide-react';
import { useFriendStore } from '@/stores/useFriendStore';
import { FriendCard } from './FriendCard';
import { EmptyState } from './EmptyState';
import { RowSkeleton } from './RowSkeleton';

export const MyFriendsTab = () => {
    const { friends, loading } = useFriendStore();

    return (
        <div className="space-y-2">
            {loading && <RowSkeleton rows={3} showAction={false} />}

            {!loading && friends.length > 0 && (
                <div className="space-y-2">
                    {friends.map(f => <FriendCard key={f.userId} friend={f} />)}
                </div>
            )}

            {!loading && friends.length === 0 && (
                <EmptyState
                    icon={Users}
                    title="No friends yet"
                    sub="Use the Find People tab to search for people and send them a request."
                />
            )}
        </div>
    );
};
