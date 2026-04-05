import { useEffect, useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { axiosInstance } from '@/lib/axios';
import { Loader, Users, Clock, Gem, Heart, Radio, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LifetimeStats {
    totalRoomsHosted:     number;
    totalStreams:         number;
    totalMinutesListened: number;
    totalCoinsEarned:    number;
    totalUniqueDonors:   number;
    lastLiveAt:          string | null;
}

interface RecentRoom {
    _id:      string;
    title:    string;
    closedAt: string | null;
    stats: {
        totalListeners:       number;
        totalMinutesListened: number;
        totalCoinsEarned:     number;
        favoriteCount:        number;
        topDonors: { name: string; totalCoins: number }[];
    } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Stat card ──────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    color: string;
}) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <div className={cn('size-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
            <Icon className="size-4 text-white" />
        </div>
        <div>
            <p className="text-lg font-bold text-white leading-none">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
    </div>
);

// ── Creator stats section ──────────────────────────────────────────────────────

const CreatorStatsSection = () => {
    const [lifetime, setLifetime] = useState<LifetimeStats | null>(null);
    const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get('/rooms/me/creator-stats')
            .then(({ data }) => {
                setLifetime(data.data.lifetime);
                setRecentRooms(data.data.recentRooms);
            })
            .catch(() => {/* no rooms hosted yet — show zeros */})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex justify-center py-8">
            <Loader className="size-5 animate-spin text-zinc-600" />
        </div>
    );

    const stats = lifetime ?? {
        totalRoomsHosted: 0, totalStreams: 0, totalMinutesListened: 0,
        totalCoinsEarned: 0, totalUniqueDonors: 0, lastLiveAt: null,
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 pb-10">
            <div>
                <h2 className="text-lg font-semibold text-white mb-1">Creator Stats</h2>
                {stats.lastLiveAt && (
                    <p className="text-xs text-zinc-500">Last live: {formatDate(stats.lastLiveAt)}</p>
                )}
            </div>

            {/* Lifetime grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard icon={Radio}   label="Rooms Hosted"    value={stats.totalRoomsHosted}                color="bg-purple-500/40" />
                <StatCard icon={Users}   label="Total Streams"   value={stats.totalStreams.toLocaleString()}   color="bg-blue-500/40" />
                <StatCard icon={Clock}   label="Hours Listened"  value={toHours(stats.totalMinutesListened)}  color="bg-indigo-500/40" />
                <StatCard icon={Gem}     label="Coins Earned"    value={stats.totalCoinsEarned.toLocaleString()} color="bg-yellow-500/40" />
                <StatCard icon={Heart}   label="Unique Donors"   value={stats.totalUniqueDonors.toLocaleString()} color="bg-pink-500/40" />
            </div>

            {/* Recent rooms */}
            {recentRooms.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent Rooms</h3>
                    <div className="space-y-2">
                        {recentRooms.map((room) => (
                            <div key={room._id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <p className="text-sm font-semibold text-white truncate">{room.title}</p>
                                    {room.closedAt && (
                                        <span className="text-xs text-zinc-600 flex-shrink-0">{formatDate(room.closedAt)}</span>
                                    )}
                                </div>

                                {room.stats ? (
                                    <>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div>
                                                <p className="text-sm font-bold text-white">{room.stats.totalListeners}</p>
                                                <p className="text-[10px] text-zinc-500">listeners</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{toHours(room.stats.totalMinutesListened)}</p>
                                                <p className="text-[10px] text-zinc-500">listened</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-yellow-400">{room.stats.totalCoinsEarned.toLocaleString()}</p>
                                                <p className="text-[10px] text-zinc-500">coins</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-pink-400">{room.stats.favoriteCount}</p>
                                                <p className="text-[10px] text-zinc-500">favorites</p>
                                            </div>
                                        </div>

                                        {room.stats.topDonors.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <Trophy className="size-3" /> Top Donors
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {room.stats.topDonors.map((d, i) => (
                                                        <span key={i} className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                                                            {d.name} · {d.totalCoins.toLocaleString()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-xs text-zinc-600">No stats available</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Page ───────────────────────────────────────────────────────────────────────

const ProfilePage = () => {
    return (
        <div className="flex flex-col items-center gap-8 py-10 px-4">
            <UserProfile
                appearance={{
                    variables: {
                        colorBackground:        '#09090b',
                        colorInputBackground:   '#18181b',
                        colorInputText:         '#ffffff',
                        colorText:              '#ffffff',
                        colorTextSecondary:     '#a1a1aa',
                        colorPrimary:           '#a855f7',
                        colorDanger:            '#f87171',
                        borderRadius:           '0.75rem',
                    },
                    elements: {
                        rootBox:               'w-full max-w-2xl',
                        card:                  'bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl',
                        navbar:                'border-r border-white/10',
                        navbarButton:          'text-zinc-400 hover:text-white hover:bg-white/5',
                        navbarButtonIcon:      'text-zinc-500',
                        headerTitle:           'text-white',
                        headerSubtitle:        'text-zinc-400',
                        formButtonPrimary:     'bg-purple-600 hover:bg-purple-500',
                        formFieldInput:        'bg-zinc-800 border-white/10 text-white',
                        formFieldLabel:        'text-zinc-300',
                        dividerLine:           'bg-white/10',
                        profileSectionTitle:   'text-white',
                        profileSectionContent: 'text-zinc-400',
                        badge:                 'bg-purple-500/20 text-purple-300',
                        accordionTriggerButton:'text-zinc-300 hover:text-white',
                    },
                }}
            />

            <CreatorStatsSection />
        </div>
    );
};

export default ProfilePage;
