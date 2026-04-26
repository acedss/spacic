import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck } from 'lucide-react';
import { getFavoriteRooms, toggleFavorite } from '@/lib/roomService';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { RoomInfo } from '@/types/types';
import { CreatorCard } from './components/CreatorCard';

export const FavoritesPage = () => {
    const navigate = useNavigate();
    const [rooms, setRooms]   = useState<RoomInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getFavoriteRooms()
            .then(res => setRooms(res.data ?? []))
            .catch(() => setRooms([]))
            .finally(() => setLoading(false));
    }, []);

    const handleUnfollow = async (roomId: string) => {
        try {
            await toggleFavorite(roomId);
            setRooms(prev => prev.filter(r => r._id !== roomId));
            toast.success('Unfollowed');
        } catch {
            toast.error('Could not unfollow');
        }
    };

    if (loading) {
        return (
            <div className="p-8 space-y-6 max-w-4xl mx-auto">
                <div className="h-8 w-40 rounded-xl bg-white/5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl bg-white/5" />)}
                </div>
            </div>
        );
    }

    const live    = rooms.filter(r => r.status === 'live');
    const offline = rooms.filter(r => r.status !== 'live');

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Your library</div>
                    <h1 className="serif italic text-white" style={{ fontSize: 36 }}>Following</h1>
                </div>
                <span className="mono text-[11px] px-3 py-1 rounded-full ring-1 ring-white/10 bg-white/4" style={{ color: 'var(--fg-2)' }}>
                    {rooms.length} {rooms.length === 1 ? 'creator' : 'creators'}
                </span>
            </div>

            {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <UserCheck className="size-12 opacity-20 text-white" />
                    <p className="text-[14px] text-white">Not following anyone yet</p>
                    <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>Favorite a room to follow its creator</p>
                    <button onClick={() => navigate('/')}
                        className="h-9 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                        Browse rooms
                    </button>
                </div>
            ) : (
                <>
                    {live.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="live-dot" style={{ width: 6, height: 6 }} />
                                <p className="mono text-[9px] uppercase tracking-widest text-[oklch(0.82_0.17_20)]">Live now</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {live.map(r => (
                                    <CreatorCard key={r._id} room={r} onUnfollow={() => handleUnfollow(r._id)} />
                                ))}
                            </div>
                        </section>
                    )}

                    {offline.length > 0 && (
                        <section className="space-y-4">
                            <p className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Offline creators</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {offline.map(r => (
                                    <CreatorCard key={r._id} room={r} onUnfollow={() => handleUnfollow(r._id)} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default FavoritesPage;
