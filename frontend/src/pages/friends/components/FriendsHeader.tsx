import { Users, SendHorizontal, Inbox } from 'lucide-react';

interface Props {
    friendsCount: number;
    requestsCount: number;
    sentCount: number;
}

export const FriendsHeader = ({ friendsCount, requestsCount, sentCount }: Props) => (
    <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
        <p className="text-zinc-500 text-sm mt-1">Connect with people on Spacic.</p>

        <div className="flex items-center gap-4 mt-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <Users className="size-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-300">{friendsCount}</span>
                <span className="text-xs text-zinc-500">friends</span>
            </div>
            {requestsCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Inbox className="size-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-300">{requestsCount}</span>
                    <span className="text-xs text-blue-400/70">incoming</span>
                </div>
            )}
            {sentCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <SendHorizontal className="size-3.5 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-300">{sentCount}</span>
                    <span className="text-xs text-yellow-400/70">pending</span>
                </div>
            )}
        </div>
    </div>
);
