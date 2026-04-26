import { Inbox } from 'lucide-react';
import { useFriendStore } from '@/stores/useFriendStore';
import { RequestCard } from './RequestCard';
import { EmptyState } from './EmptyState';
import { RowSkeleton } from './RowSkeleton';

export const RequestsTab = () => {
    const { requests, loading } = useFriendStore();

    return (
        <div className="space-y-2">
            {loading && <RowSkeleton rows={2} />}

            {!loading && requests.length > 0 && (
                <div className="space-y-2">
                    {requests.map(r => <RequestCard key={r._id} request={r} />)}
                </div>
            )}

            {!loading && requests.length === 0 && (
                <EmptyState
                    icon={Inbox}
                    title="No pending requests"
                    sub="When someone sends you a friend request, it'll show up here."
                />
            )}
        </div>
    );
};
