import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { getPublicProfile, type PublicProfile } from '@/lib/userService';
import { Clock, Music2, Gem, Gamepad2, Trophy, Mic2, Users, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
    userId: string | null;
    userName: string;
    imageUrl: string;
    onClose: () => void;
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
    return (
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/5 ring-1 ring-white/8">
            <Icon className="size-3.5 mb-0.5" style={{ color: 'var(--fg-3)' }} />
            <span className="mono text-[18px] font-bold text-white tabular-nums">{value}</span>
            <span className="text-[10px] uppercase tracking-widest mono" style={{ color: 'var(--fg-3)' }}>{label}</span>
        </div>
    );
}

export const UserPublicProfileModal = ({ userId, userName, imageUrl, onClose }: Props) => {
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        setProfile(null);
        getPublicProfile(userId)
            .then(setProfile)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId]);

    const joinedYear = profile ? new Date(profile.joinedAt).getFullYear() : null;

    return (
        <Sheet open={!!userId} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent
                side="right"
                className="w-[340px] border-l border-white/10 p-0 overflow-y-auto hide-scrollbar"
                style={{ background: 'var(--ink-1)' }}>

                {/* Hero */}
                <div className="relative h-28 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, oklch(0.22 0.06 75), oklch(0.18 0.04 295))' }}>
                    <div className="absolute inset-0 grain opacity-20" />
                    <div className="absolute bottom-0 left-0 right-0 h-16"
                        style={{ background: 'linear-gradient(to top, var(--ink-1), transparent)' }} />
                </div>

                {/* Avatar — overlaps hero */}
                <div className="px-5 -mt-9 relative z-10">
                    <div className="flex items-end justify-between">
                        <div className="relative">
                            {imageUrl
                                ? <img src={imageUrl} alt={userName}
                                    className="w-16 h-16 rounded-full object-cover ring-2 ring-[oklch(0.88_0.12_75)]"
                                    style={{ boxShadow: '0 0 20px oklch(0.88 0.12 75 / 0.4)' }} />
                                : <div className="w-16 h-16 rounded-full ring-2 ring-[oklch(0.88_0.12_75)] bg-[oklch(0.3_0.08_295)] flex items-center justify-center text-2xl font-bold text-white">
                                    {userName[0]?.toUpperCase()}
                                </div>
                            }
                            {profile && (
                                <span className={cn('absolute -bottom-0.5 -right-0.5 text-[9px] mono font-bold px-1.5 py-0.5 rounded-full ring-1 ring-white/10',
                                    profile.userTier === 'CREATOR' ? 'bg-[oklch(0.22_0.06_75)] text-[oklch(0.88_0.12_75)]' :
                                    profile.userTier === 'PREMIUM' ? 'bg-[oklch(0.2_0.06_295)] text-[oklch(0.72_0.18_295)]' :
                                    'bg-white/8 text-white/50')}>
                                    {profile.userTier}
                                </span>
                            )}
                        </div>
                        {joinedYear && (
                            <div className="flex items-center gap-1 text-[10px] mb-2" style={{ color: 'var(--fg-3)' }}>
                                <Calendar className="size-3" /> Since {joinedYear}
                            </div>
                        )}
                    </div>

                    <SheetHeader className="mt-3 mb-0 text-left">
                        <h2 className="text-[18px] font-bold text-white leading-tight">
                            {profile?.fullName ?? userName}
                        </h2>
                        {profile?.username && (
                            <p className="text-[12px] mono mt-0.5" style={{ color: 'var(--fg-3)' }}>@{profile.username}</p>
                        )}
                    </SheetHeader>
                </div>

                <div className="px-5 pb-8 space-y-5 mt-4">
                    {/* Badges */}
                    {loading && (
                        <div className="flex gap-2 flex-wrap">
                            {[1,2,3].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full bg-white/5" />)}
                        </div>
                    )}
                    {profile?.badges && profile.badges.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {profile.badges.map(b => (
                                <span key={b.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] mono font-semibold ring-1 ring-white/10 bg-white/5 text-white">
                                    {b.emoji} {b.label}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Stats grid */}
                    {loading ? (
                        <div className="grid grid-cols-2 gap-2">
                            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
                        </div>
                    ) : profile ? (
                        <>
                            <div>
                                <p className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>Stats</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <StatCard icon={Clock}    label="Hours listened"  value={profile.stats.listeningHours} />
                                    <StatCard icon={Gem}      label="Coins donated"   value={profile.stats.totalCoinsDonated.toLocaleString()} />
                                    <StatCard icon={Music2}   label="Rooms joined"    value={profile.stats.roomsJoined} />
                                    <StatCard icon={Trophy}   label="Game wins"       value={profile.stats.minigameWins} />
                                    <StatCard icon={Gamepad2} label="Games played"    value={profile.stats.gamesPlayed} />
                                    <StatCard icon={Gem}      label="Donations made"  value={profile.stats.donationsMade} />
                                </div>
                            </div>

                            {/* Creator stats */}
                            {profile.creatorStats && (
                                <div>
                                    <p className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>Creator</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard icon={Mic2}  label="Rooms hosted"  value={profile.creatorStats.totalRoomsHosted} />
                                        <StatCard icon={Users} label="Total streams" value={profile.creatorStats.totalStreams.toLocaleString()} />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
};
