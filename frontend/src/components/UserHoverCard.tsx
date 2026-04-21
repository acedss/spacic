import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { UserPlus, Check, Clock, ExternalLink, Music2, Trophy, Gem } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicProfile, type PublicProfile } from '@/lib/userService';
import { useFriendStore } from '@/stores/useFriendStore';
import { cn } from '@/lib/utils';

const TIER_COLOR: Record<string, string> = {
    CREATOR: 'oklch(0.88 0.12 75)',
    PREMIUM:  'oklch(0.72 0.18 295)',
    FREE:     'oklch(0.5 0.01 285)',
};

interface Props {
    userId: string | null;
    userName: string;
    imageUrl?: string;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    openDelay?: number;
}

export const UserHoverCard = ({ userId, userName, imageUrl, children, side = 'right', openDelay = 400 }: Props) => {
    const navigate = useNavigate();
    const { userId: clerkUserId } = useAuth();
    const { friends, sentRequests, sendRequest } = useFriendStore();
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const hasFetched = useRef(false);
    const [adding, setAdding] = useState(false);

    const isFriend  = friends.some(f => f.userId === userId);
    const isPending = sentRequests.some(r => r.recipient.userId === userId);
    const joinedYear = profile ? new Date(profile.joinedAt).getFullYear() : null;
    const tierColor = TIER_COLOR[profile?.userTier ?? 'FREE'];

    const handleOpenChange = (open: boolean) => {
        if (open && userId && !hasFetched.current) {
            hasFetched.current = true;
            setLoading(true);
            getPublicProfile(userId)
                .then(setProfile)
                .catch(() => {})
                .finally(() => setLoading(false));
        }
    };

    const handleAddFriend = async () => {
        if (!userId || isFriend || isPending || adding) return;
        setAdding(true);
        try { await sendRequest(userId); } finally { setAdding(false); }
    };

    if (!userId) return <>{children}</>;

    return (
        <HoverCard openDelay={openDelay} closeDelay={100} onOpenChange={handleOpenChange}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent
                side={side}
                align="start"
                sideOffset={8}
                className="w-72 p-0 border-0 shadow-2xl overflow-hidden"
                style={{ background: 'var(--ink-1)', border: '1px solid rgba(255,255,255,0.08)' }}>

                {/* Header gradient */}
                <div className="relative h-16 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, oklch(0.18 0.05 ${profile?.userTier === 'CREATOR' ? 75 : 295}), oklch(0.14 0.03 285))` }}>
                    <div className="absolute inset-0 grain opacity-20" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--ink-1) 0%, transparent 100%)' }} />
                </div>

                {/* Avatar — overlaps header */}
                <div className="px-4 -mt-7 relative z-10">
                    <div className="flex items-end justify-between">
                        <Avatar className="w-12 h-12 ring-2 ring-[var(--ink-1)]"
                            style={{ outline: `2px solid ${tierColor}`, outlineOffset: '1px' }}>
                            <AvatarImage src={profile?.imageUrl ?? imageUrl} />
                            <AvatarFallback className="text-sm font-bold"
                                style={{ background: 'var(--ink-2)', color: 'var(--fg-1)' }}>
                                {userName[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        {joinedYear && (
                            <span className="mono text-[9px] pb-1" style={{ color: 'var(--fg-3)' }}>
                                Since {joinedYear}
                            </span>
                        )}
                    </div>

                    {/* Name + tier */}
                    <div className="mt-2">
                        <p className="text-[14px] font-bold text-white leading-tight">
                            {profile?.fullName ?? userName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            {profile?.username && (
                                <span className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
                                    @{profile.username}
                                </span>
                            )}
                            {profile?.userTier && profile.userTier !== 'FREE' && (
                                <span className="mono text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
                                    {profile.userTier}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-4 pt-3 pb-4 space-y-3">
                    {/* Badges */}
                    {loading ? (
                        <div className="flex gap-1.5">
                            <Skeleton className="h-5 w-16 rounded-full" style={{ background: 'var(--ink-2)' }} />
                            <Skeleton className="h-5 w-14 rounded-full" style={{ background: 'var(--ink-2)' }} />
                        </div>
                    ) : profile?.badges && profile.badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {profile.badges.slice(0, 4).map(b => (
                                <span key={b.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mono text-[9px] font-semibold"
                                    style={{ background: 'var(--ink-2)', color: 'var(--fg-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {b.emoji} {b.label}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {/* Quick stats */}
                    {loading ? (
                        <div className="grid grid-cols-3 gap-2">
                            {[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" style={{ background: 'var(--ink-2)' }} />)}
                        </div>
                    ) : profile ? (
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { icon: Music2,  label: 'Rooms',  value: profile.stats.roomsJoined },
                                { icon: Trophy,  label: 'Wins',   value: profile.stats.minigameWins },
                                { icon: Gem,     label: 'Coins',  value: profile.stats.totalCoinsDonated >= 1000 ? `${(profile.stats.totalCoinsDonated / 1000).toFixed(1)}k` : profile.stats.totalCoinsDonated },
                            ].map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex flex-col items-center gap-0.5 py-2 rounded-lg"
                                    style={{ background: 'var(--ink-2)' }}>
                                    <Icon className="size-3" style={{ color: 'var(--fg-3)' }} />
                                    <span className="mono text-[13px] font-bold text-white tabular-nums">{value}</span>
                                    <span className="mono text-[8px] uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Actions */}
                    <div className="flex gap-2">
                        {/* Add Friend — hidden if this is the current user */}
                        {!isFriend && !isPending && (
                            <button
                                onClick={handleAddFriend}
                                disabled={adding}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold press transition-all',
                                    adding ? 'opacity-60' : '',
                                )}
                                style={{ background: 'oklch(0.68 0.21 295 / 0.15)', color: 'oklch(0.82 0.14 295)', border: '1px solid oklch(0.68 0.21 295 / 0.3)' }}>
                                {adding
                                    ? <Clock className="size-3 animate-spin" />
                                    : <UserPlus className="size-3" />
                                }
                                Add Friend
                            </button>
                        )}
                        {isFriend && (
                            <div className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold"
                                style={{ background: 'oklch(0.74 0.14 160 / 0.12)', color: 'oklch(0.74 0.14 160)', border: '1px solid oklch(0.74 0.14 160 / 0.3)' }}>
                                <Check className="size-3" /> Friends
                            </div>
                        )}
                        {!isFriend && isPending && (
                            <div className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold opacity-60"
                                style={{ background: 'var(--ink-2)', color: 'var(--fg-3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <Clock className="size-3" /> Pending
                            </div>
                        )}

                        {/* View profile */}
                        <button
                            onClick={() => navigate(`/friends?user=${userId}`)}
                            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg press transition-all"
                            style={{ background: 'var(--ink-2)', color: 'var(--fg-3)', border: '1px solid rgba(255,255,255,0.08)' }}
                            title="View full profile">
                            <ExternalLink className="size-3.5" />
                        </button>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
