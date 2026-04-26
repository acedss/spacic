import { ArrowRight, Gem, Play, Zap } from 'lucide-react';
import type { GenreId, OnboardingRoom } from './onboarding-shared';

export const StepTuned = ({ genres, moods, liked, referral, onBack, onFinish, rooms }: {
    genres: Set<GenreId>; moods: Set<string>; liked: Set<string>; referral: string;
    onBack: () => void; onFinish: () => void; rooms: OnboardingRoom[];
}) => {
    const roomCount = genres.size * 4 + moods.size * 2;
    const totalCoins = 50 + (referral.length >= 3 ? 25 : 0);
    return (
        <div className="grid grid-cols-12 gap-10 items-center min-h-[540px]">
            <div className="col-span-5">
                <div className="mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--fg-3)' }}>06 · Ready</div>
                <h1 className="serif text-white leading-[0.95] tracking-[-0.02em]" style={{ fontSize: 72 }}>
                    Your dial is{' '}
                    <em className="italic" style={{
                        background: 'linear-gradient(100deg, oklch(0.88 0.12 75), oklch(0.7 0.2 295))',
                        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                    }}>tuned.</em>
                </h1>
                <p className="mt-5 text-[15px] leading-relaxed max-w-[420px]" style={{ color: 'var(--fg-1)' }}>
                    Based on your taste, we've lined up {roomCount} live rooms starting tonight.
                    {liked.size > 0 && ` You liked ${liked.size} tracks — we'll queue more like them.`}
                    {' '}Your welcome coins landed in your wallet.
                </p>

                <div className="mt-8 p-5 rounded-2xl ring-1 ring-[oklch(0.82_0.15_75_/_0.4)]"
                    style={{ background: 'linear-gradient(145deg, oklch(0.22 0.05 75 / 0.4), oklch(0.14 0.03 60))' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full grid place-items-center bg-[oklch(0.88_0.12_75_/_0.15)]">
                            <Gem className="size-4.5 text-[oklch(0.88_0.12_75)]" />
                        </div>
                        <div className="flex-1">
                            <p className="mono text-[9px] uppercase tracking-widest text-[oklch(0.88_0.12_75)]">
                                Welcome{referral.length >= 3 ? ' + referral' : ''} gift
                            </p>
                            <p className="mono text-[24px] text-white tabular-nums mt-0.5">{totalCoins} coins</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2.5 py-1 bg-[oklch(0.82_0.15_75_/_0.14)] text-[oklch(0.88_0.12_75)] ring-1 ring-[oklch(0.82_0.15_75_/_0.35)]">
                            Auto-applied
                        </span>
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-3">
                    <button onClick={onBack}
                        className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/15 text-white text-[14px] hover:bg-white/4 press">
                        Back
                    </button>
                    <button onClick={onFinish}
                        className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press">
                        <Zap className="size-3.5" /> Open my first room <ArrowRight className="size-3.5" />
                    </button>
                </div>
            </div>

            <div className="col-span-7 space-y-3">
                <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>
                    Picked for you · starting in the next 2 hours
                </div>
                {rooms.slice(0, 4).map((r, i) => (
                    <div key={r._id}
                        className="flex items-center gap-4 p-3 rounded-xl ring-1 ring-white/10 press hover:ring-white/25 transition-all"
                        style={{ background: 'var(--ink-2)' }}>
                        <img src={r.playlist?.[0]?.imageUrl ?? 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=70'}
                            className="w-16 h-16 rounded-lg object-cover shrink-0" alt="" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-0.5 bg-[oklch(0.72_0.22_20_/_0.12)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.35)]">
                                    <span className="live-dot" style={{ width: 4, height: 4 }} /> {r.listenerCount}
                                </span>
                                <span className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>
                                    because you picked {[...genres][i % genres.size] ?? 'ambient'}
                                </span>
                            </div>
                            <p className="serif text-[20px] text-white italic mt-1 leading-tight truncate">{r.title}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--fg-3)' }}>
                                {r.creatorId?.fullName ?? '—'} · {r.description ?? ''}
                            </p>
                        </div>
                        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl ring-1 ring-white/12 text-[12px] hover:bg-white/8 press shrink-0"
                            style={{ color: 'var(--fg-2)' }}>
                            Preview <Play className="size-3 ml-0.5" />
                        </button>
                    </div>
                ))}
                {rooms.length === 0 && (
                    <div className="py-12 text-center">
                        <p className="text-[13px]" style={{ color: 'var(--fg-3)' }}>No rooms live right now — check back soon!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
