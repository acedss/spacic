import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, SendHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useFriendStore } from '@/stores/useFriendStore';
import { SearchCard } from './SearchCard';
import { SentRequestCard } from './SentRequestCard';
import { EmptyState } from './EmptyState';
import { RowSkeleton } from './RowSkeleton';

export const FindPeopleTab = () => {
    const [query, setQuery] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { searchResults, searchLoading, sentRequests, searchUsers, clearSearch } = useFriendStore();

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) { clearSearch(); return; }
        debounceRef.current = setTimeout(() => searchUsers(value), 350);
    }, [searchUsers, clearSearch]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    placeholder="Search by name..."
                    className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/40 rounded-xl"
                />
            </div>

            {searchLoading && <RowSkeleton rows={3} />}

            {!searchLoading && searchResults.length > 0 && (
                <div className="space-y-2">
                    {searchResults.map(r => <SearchCard key={r.userId} result={r} />)}
                </div>
            )}

            {!searchLoading && query && searchResults.length === 0 && (
                <EmptyState
                    icon={Search}
                    title={`No results for "${query}"`}
                    sub="Try a different name. Only exact name matches are returned."
                />
            )}

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
                            {sentRequests.map(r => <SentRequestCard key={r._id} request={r} />)}
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
        </div>
    );
};
