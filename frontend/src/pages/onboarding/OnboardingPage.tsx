import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { ArrowRight, Check, Play, Gem, Zap, ThumbsUp, ThumbsDown, UserPlus, AtSign } from 'lucide-react'
import { axiosInstance } from '@/lib/axios'

/* ─── Static data ──────────────────────────────────────────────────────── */
const GENRES = [
    { id: 'ambient',     label: 'Ambient',      hue: 'oklch(0.68 0.21 240)' },
    { id: 'lofi',        label: 'Lo-fi',         hue: 'oklch(0.7 0.18 200)' },
    { id: 'indie',       label: 'Indie',         hue: 'oklch(0.72 0.2 150)' },
    { id: 'rnb',         label: 'R&B',           hue: 'oklch(0.72 0.22 20)' },
    { id: 'electronic',  label: 'Electronic',    hue: 'oklch(0.68 0.21 295)' },
    { id: 'jazz',        label: 'Jazz',          hue: 'oklch(0.78 0.15 75)' },
    { id: 'classical',   label: 'Classical',     hue: 'oklch(0.75 0.1 60)' },
    { id: 'hiphop',      label: 'Hip-Hop',       hue: 'oklch(0.7 0.2 330)' },
    { id: 'soul',        label: 'Soul',          hue: 'oklch(0.74 0.18 40)' },
    { id: 'acoustic',    label: 'Acoustic',      hue: 'oklch(0.76 0.12 90)' },
    { id: 'pop',         label: 'Pop',           hue: 'oklch(0.75 0.22 340)' },
    { id: 'focus',       label: 'Focus',         hue: 'oklch(0.7 0.15 210)' },
    { id: 'experimental',label: 'Experimental',  hue: 'oklch(0.65 0.2 280)' },
    { id: 'folk',        label: 'Folk',          hue: 'oklch(0.77 0.13 80)' },
] as const

const MOODS = ['Late Night', 'Ambient', 'Chill', 'Focus', 'Hype', 'Sad Hours', 'Morning Coffee', 'Indie Vibes', 'Jazz Bar', 'Lo-fi Study', 'After Hours', 'Road Trip']

type GenreId = typeof GENRES[number]['id']

interface OnboardingSong {
    _id: string; title: string; artist: string; imageUrl: string; duration: number;
}
interface OnboardingCreator {
    _id: string; fullName: string; imageUrl: string; username?: string;
    creatorStats?: { totalRoomsHosted?: number; totalStreams?: number };
}
interface OnboardingRoom {
    _id: string; title: string; description?: string; listenerCount: number;
    creatorId?: { fullName: string; imageUrl: string };
    playlist?: Array<{ imageUrl?: string }>;
}

const AVATAR_BG = (seed: string) =>
    `oklch(0.55 0.18 ${(seed.charCodeAt(0) * 47 + (seed.charCodeAt(1) ?? 0) * 13) % 360})`

/* ─── Progress bar ─────────────────────────────────────────────────────── */
const Progress = ({ step, total = 7 }: { step: number; total?: number }) => (
    <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-[3px] w-8 rounded-full transition-all duration-500"
                  style={{ background: i <= step ? 'oklch(0.88 0.12 75)' : 'oklch(1 0 0 / 0.1)' }} />
        ))}
        <span className="mono text-[10px] ml-2 tabular-nums" style={{ color: 'var(--fg-3)' }}>
            0{step + 1} / 0{total}
        </span>
    </div>
)

/* ─── StepHead ─────────────────────────────────────────────────────────── */
const StepHead = ({ kicker, title, sub }: { kicker: string; title: React.ReactNode; sub: string }) => (
    <div className="max-w-[720px]">
        <div className="mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--fg-3)' }}>{kicker}</div>
        <h1 className="serif text-white leading-[1] tracking-[-0.015em]" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}>{title}</h1>
        <p className="mt-5 text-[16px] leading-relaxed" style={{ color: 'var(--fg-1)' }}>{sub}</p>
    </div>
)

/* ─── StepFooter ───────────────────────────────────────────────────────── */
const StepFooter = ({
    selected, min = 0, optional = false, onBack, onNext, nextLabel = 'Continue',
}: {
    selected: number; min?: number; optional?: boolean;
    onBack: () => void; onNext: () => void; nextLabel?: string;
}) => {
    const canContinue = optional || selected >= min
    return (
        <div className="mt-12 pt-6 border-t hair flex items-center justify-between">
            <button onClick={onBack}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/15 text-[14px] text-white hover:bg-white/4 press">
                Back
            </button>
            <div className="flex items-center gap-4">
                <span className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>
                    {optional ? 'optional' : canContinue ? `${selected} selected` : `${selected}/${min} to continue`}
                </span>
                <button onClick={onNext} disabled={!canContinue}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press disabled:opacity-40 disabled:cursor-not-allowed">
                    {nextLabel} <ArrowRight className="size-3.5" />
                </button>
            </div>
        </div>
    )
}

/* ─── Step 0: Welcome ──────────────────────────────────────────────────── */
const StepWelcome = ({ onNext, rooms }: { onNext: () => void; rooms: OnboardingRoom[] }) => {
    const featured = rooms[0]
    return (
        <div className="grid grid-cols-12 gap-12 items-center min-h-[620px]">
            <div className="col-span-7">
                <div className="mono text-[10px] uppercase tracking-[0.25em] mb-4" style={{ color: 'var(--fg-3)' }}>Welcome to Spacic</div>
                <h1 className="serif text-white leading-[0.95] tracking-[-0.02em]" style={{ fontSize: 'clamp(48px, 6vw, 88px)' }}>
                    Music is better<br />
                    <span className="italic" style={{
                        background: 'linear-gradient(100deg, oklch(0.88 0.12 75), oklch(0.78 0.22 330), oklch(0.7 0.2 295))',
                        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                    }}>in the same room.</span>
                </h1>
                <p className="mt-6 text-[17px] leading-relaxed max-w-[480px]" style={{ color: 'var(--fg-1)' }}>
                    You're about to join thousands of people listening live, together. Let's tune it to you — a few quick steps, under two minutes.
                </p>
                <div className="mt-8 flex items-center gap-3">
                    <button onClick={onNext}
                        className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-white text-[var(--ink-0)] text-[15px] font-semibold press">
                        Tune my dial <ArrowRight className="size-4" />
                    </button>
                    <span className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>· cancel anytime</span>
                </div>

                <div className="mt-12 pt-8 border-t hair grid grid-cols-3 gap-6 max-w-[480px]">
                    {[['412+', 'rooms live now'], ['1.2M', 'listening hours / mo'], ['38ms', 'sync accuracy']].map(([v, l]) => (
                        <div key={l}>
                            <p className="mono text-[24px] text-white tabular-nums">{v}</p>
                            <p className="mono text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--fg-3)' }}>{l}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="col-span-5">
                <div className="relative rounded-3xl overflow-hidden ring-1 ring-white/10" style={{ aspectRatio: '4/5' }}>
                    {featured ? (
                        <>
                            <img src={featured.playlist?.[0]?.imageUrl ?? 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'}
                                 className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, oklch(0.08 0.015 285 / 0.92))' }} />
                            <div className="absolute bottom-6 left-6 right-6">
                                <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                                    <span className="live-dot" style={{ width: 5, height: 5 }} /> {featured.listenerCount} listening now
                                </span>
                                <h3 className="serif text-[28px] text-white italic mt-3 leading-tight">{featured.title}</h3>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full grid place-items-center" style={{ background: 'var(--ink-2)' }}>
                            <span className="serif italic text-[32px] text-white/20">spacic</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─── Step 1: Taste (genres) ───────────────────────────────────────────── */
const StepTaste = ({ genres, toggle, onBack, onNext }: {
    genres: Set<GenreId>; toggle: (id: GenreId) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="01 · Taste"
            title={<>What does your <em className="italic">night</em> sound like?</>}
            sub="Pick 3 or more. We'll use these to surface rooms and recommend creators."
        />
        <div className="flex flex-wrap gap-2.5 mt-10 max-w-[860px]">
            {GENRES.map(g => (
                <button key={g.id} onClick={() => toggle(g.id)}
                    className={`chip rounded-full px-5 py-2.5 text-[14px] ring-1 ring-white/12 flex items-center gap-2 press ${genres.has(g.id) ? 'chip-on' : ''}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.hue }} />
                    {g.label}
                    {genres.has(g.id) && <Check className="size-3 ml-0.5" />}
                </button>
            ))}
        </div>
        <StepFooter selected={genres.size} min={3} onBack={onBack} onNext={onNext} />
    </div>
)

/* ─── Step 2: Mood ─────────────────────────────────────────────────────── */
const StepMood = ({ moods, toggle, onBack, onNext }: {
    moods: Set<string>; toggle: (m: string) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="02 · Mood"
            title={<>When are you <em className="italic">tuning in?</em></>}
            sub="Pick the settings you most often find yourself in — we'll match you to the right station."
        />
        <div className="grid grid-cols-4 gap-3 mt-10 max-w-[860px]">
            {MOODS.map((m, i) => {
                const on = moods.has(m)
                const hue = 230 + (i * 17) % 180
                return (
                    <button key={m} onClick={() => toggle(m)}
                        className={`press relative rounded-xl overflow-hidden ring-1 transition-all ${on ? 'ring-[oklch(0.88_0.12_75)]' : 'ring-white/10 hover:ring-white/25'}`}
                        style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, oklch(0.3 0.09 ${hue}), oklch(0.16 0.04 ${hue + 30}))` }}>
                        <span className="absolute bottom-3 left-3 serif text-[20px] text-white italic">{m}</span>
                        {on && (
                            <span className="absolute top-3 right-3 w-6 h-6 rounded-full grid place-items-center bg-[oklch(0.88_0.12_75)] text-[var(--ink-0)]">
                                <Check className="size-3.5" />
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
        <StepFooter selected={moods.size} min={1} onBack={onBack} onNext={onNext} />
    </div>
)

/* ─── Step 3: Songs — like/dislike from real DB ───────────────────────── */
const StepSongs = ({ songs, liked, disliked, onLike, onDislike, onBack, onNext }: {
    songs: OnboardingSong[]; liked: Set<string>; disliked: Set<string>;
    onLike: (id: string) => void; onDislike: (id: string) => void;
    onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="03 · Discovery"
            title={<>Rate a few <em className="italic">tracks.</em></>}
            sub="Like or skip — we'll learn what to queue for you and what to avoid."
        />
        <div className="grid grid-cols-2 gap-3 mt-10 max-w-[860px]">
            {songs.map(song => {
                const isLiked = liked.has(song._id)
                const isDisliked = disliked.has(song._id)
                return (
                    <div key={song._id}
                         className={`flex items-center gap-3 p-3 rounded-xl ring-1 transition-all ${
                             isLiked ? 'ring-[oklch(0.74_0.14_160)] bg-[oklch(0.74_0.14_160_/_0.08)]'
                             : isDisliked ? 'ring-white/5 opacity-40'
                             : 'ring-white/10 hover:ring-white/20'
                         }`}
                         style={{ background: isLiked || isDisliked ? undefined : 'var(--ink-2)' }}>
                        {song.imageUrl ? (
                            <img src={song.imageUrl} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                        ) : (
                            <div className="w-12 h-12 rounded-lg grid place-items-center shrink-0 bg-white/8">
                                <Play className="size-4 text-white/40" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white truncate">{song.title}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--fg-3)' }}>{song.artist}</p>
                            <p className="mono text-[9px]" style={{ color: 'var(--fg-3)' }}>
                                {Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => onDislike(song._id)}
                                className={`w-8 h-8 rounded-lg grid place-items-center press transition-all ${
                                    isDisliked ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' : 'hover:bg-white/8 text-white/30 hover:text-white/60'
                                }`}>
                                <ThumbsDown className="size-3.5" />
                            </button>
                            <button onClick={() => onLike(song._id)}
                                className={`w-8 h-8 rounded-lg grid place-items-center press transition-all ${
                                    isLiked ? 'bg-[oklch(0.74_0.14_160_/_0.2)] text-[oklch(0.74_0.14_160)] ring-1 ring-[oklch(0.74_0.14_160_/_0.3)]' : 'hover:bg-white/8 text-white/30 hover:text-white/60'
                                }`}>
                                <ThumbsUp className="size-3.5" />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
        <StepFooter selected={liked.size + disliked.size} min={3} onBack={onBack} onNext={onNext} />
    </div>
)

/* ─── Step 4: Circle (follow real creators from DB) ──────────────────── */
const StepCircle = ({ creators, following, toggle, onBack, onNext }: {
    creators: OnboardingCreator[]; following: Set<string>; toggle: (id: string) => void;
    onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="04 · Circle"
            title={<>Find the people who <em className="italic">play your songs.</em></>}
            sub="Follow creators — their rooms will appear on your home feed."
        />
        <div className="grid grid-cols-3 gap-4 mt-10 max-w-[980px]">
            {creators.map(c => {
                const on = following.has(c._id)
                return (
                    <div key={c._id}
                         className={`relative rounded-2xl ring-1 p-5 transition-all ${on ? 'ring-[oklch(0.68_0.21_295)]' : 'ring-white/10 hover:ring-white/20'}`}
                         style={{ background: 'var(--ink-2)' }}>
                        <div className="flex items-center gap-3">
                            {c.imageUrl ? (
                                <img src={c.imageUrl} className="w-14 h-14 rounded-full object-cover ring-1 ring-white/15 shrink-0" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-full ring-1 ring-white/15 grid place-items-center text-[18px] font-bold text-white shrink-0"
                                     style={{ background: AVATAR_BG(c.fullName) }}>
                                    {c.fullName[0]}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-white">{c.fullName}</p>
                                <p className="text-[11px] mono" style={{ color: 'var(--fg-3)' }}>
                                    {c.username ? `@${c.username}` : 'creator'}
                                    {c.creatorStats?.totalStreams ? ` · ${c.creatorStats.totalStreams.toLocaleString()} streams` : ''}
                                </p>
                            </div>
                        </div>
                        <p className="mt-3 text-[12px] leading-snug" style={{ color: 'var(--fg-2)' }}>
                            {c.creatorStats?.totalRoomsHosted
                                ? `Hosted ${c.creatorStats.totalRoomsHosted} rooms`
                                : 'New creator'}
                        </p>
                        <button onClick={() => toggle(c._id)}
                            className={`mt-4 w-full h-9 rounded-lg text-[12px] font-medium press ring-1 transition-all ${
                                on ? 'bg-[oklch(0.68_0.21_295)] text-white ring-[oklch(0.68_0.21_295)]'
                                   : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'
                            }`}>
                            {on ? <><Check className="inline size-3.5 mr-1 -mt-0.5" /> Following</> : 'Follow'}
                        </button>
                    </div>
                )
            })}
        </div>
        <StepFooter selected={following.size} min={0} optional onBack={onBack} onNext={onNext} />
    </div>
)

/* ─── Step 5: Referral — enter friend's username ─────────────────────── */
const StepReferral = ({ referral, setReferral, onBack, onNext }: {
    referral: string; setReferral: (v: string) => void; onBack: () => void; onNext: () => void;
}) => (
    <div>
        <StepHead
            kicker="05 · Invite"
            title={<>Got a friend <em className="italic">already here?</em></>}
            sub="Enter their username and you'll both get 25 bonus coins. Skip if you don't have one."
        />
        <div className="mt-10 max-w-[480px]">
            <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--fg-3)' }} />
                <input
                    value={referral}
                    onChange={(e) => setReferral(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="friend_username"
                    className="w-full pl-10 pr-4 h-14 rounded-xl bg-white/6 ring-1 ring-white/10 text-[16px] text-white placeholder:text-[var(--fg-3)] outline-none focus:ring-[oklch(0.68_0.21_295_/_0.5)] mono"
                />
            </div>
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl ring-1 ring-[oklch(0.82_0.15_75_/_0.3)]"
                 style={{ background: 'oklch(0.22 0.05 75 / 0.3)' }}>
                <UserPlus className="size-5 text-[oklch(0.88_0.12_75)] shrink-0" />
                <div>
                    <p className="text-[13px] text-white font-medium">Referral bonus</p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-2)' }}>
                        Both you and your friend receive <span className="text-[oklch(0.88_0.12_75)] font-semibold">25 coins</span> each.
                    </p>
                </div>
            </div>
        </div>
        <StepFooter selected={referral.length >= 3 ? 1 : 0} min={0} optional onBack={onBack} onNext={onNext} />
    </div>
)

/* ─── Step 6: Ready (tuned) ────────────────────────────────────────────── */
const StepTuned = ({ genres, moods, liked, referral, onBack, onFinish, rooms }: {
    genres: Set<GenreId>; moods: Set<string>; liked: Set<string>; referral: string;
    onBack: () => void; onFinish: () => void; rooms: OnboardingRoom[];
}) => {
    const roomCount = genres.size * 4 + moods.size * 2
    const totalCoins = 50 + (referral.length >= 3 ? 25 : 0)
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
    )
}

/* ─── Main OnboardingPage ──────────────────────────────────────────────── */
const OnboardingPage = () => {
    const { user } = useUser()
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [genres, setGenres]       = useState<Set<GenreId>>(new Set(['ambient', 'lofi']))
    const [moods, setMoods]         = useState<Set<string>>(new Set(['Late Night']))
    const [following, setFollowing] = useState<Set<string>>(new Set())
    const [likedSongs, setLikedSongs]       = useState<Set<string>>(new Set())
    const [dislikedSongs, setDislikedSongs] = useState<Set<string>>(new Set())
    const [referral, setReferral]   = useState('')
    const [songs, setSongs]         = useState<OnboardingSong[]>([])
    const [creators, setCreators]   = useState<OnboardingCreator[]>([])
    const [rooms, setRooms]         = useState<OnboardingRoom[]>([])
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        axiosInstance.get('/auth/onboarding/data')
            .then(({ data }) => {
                setSongs(data.songs ?? [])
                setCreators(data.creators ?? [])
                setRooms(data.rooms ?? [])
            })
            .catch(() => {})
    }, [])

    const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, val: T) => {
        const n = new Set(set)
        n.has(val) ? n.delete(val) : n.add(val)
        setter(n)
    }

    const handleLike = (id: string) => {
        const n = new Set(likedSongs)
        if (n.has(id)) { n.delete(id) } else { n.add(id); dislikedSongs.delete(id); setDislikedSongs(new Set(dislikedSongs)) }
        setLikedSongs(n)
    }

    const handleDislike = (id: string) => {
        const n = new Set(dislikedSongs)
        if (n.has(id)) { n.delete(id) } else { n.add(id); likedSongs.delete(id); setLikedSongs(new Set(likedSongs)) }
        setDislikedSongs(n)
    }

    const finish = async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            await axiosInstance.post('/auth/onboarding/complete', {
                genres: [...genres],
                moods: [...moods],
                likedSongIds: [...likedSongs],
                dislikedSongIds: [...dislikedSongs],
                referralUsername: referral || undefined,
            })
        } catch { /* onboarding still completes locally */ }
        setSubmitting(false)
        navigate('/')
    }

    const skip = async () => {
        try { await axiosInstance.post('/auth/onboarding/complete') } catch {}
        navigate('/')
    }

    const TOTAL_STEPS = 7

    return (
        <div className="min-h-screen relative" style={{ background: 'var(--ink-0)', fontFamily: "'Figtree', system-ui, sans-serif" }}>
            <div className="aurora aurora-breathe" />
            <div className="grain" />

            <div className="relative z-10 flex items-center justify-between px-10 h-16">
                <div className="flex items-baseline gap-1.5">
                    <span className="serif italic text-[24px] text-white">spacic</span>
                    <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>fm</span>
                </div>
                <Progress step={step} total={TOTAL_STEPS} />
                <button onClick={skip} className="text-[12px] hover:text-white transition-colors" style={{ color: 'var(--fg-3)' }}>
                    Skip setup
                </button>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-10 pt-10 pb-20">
                {step === 0 && <StepWelcome onNext={() => setStep(1)} rooms={rooms} />}
                {step === 1 && (
                    <StepTaste genres={genres} toggle={v => toggle(genres, setGenres, v)} onBack={() => setStep(0)} onNext={() => setStep(2)} />
                )}
                {step === 2 && (
                    <StepMood moods={moods} toggle={v => toggle(moods, setMoods, v)} onBack={() => setStep(1)} onNext={() => setStep(3)} />
                )}
                {step === 3 && (
                    <StepSongs songs={songs} liked={likedSongs} disliked={dislikedSongs}
                        onLike={handleLike} onDislike={handleDislike}
                        onBack={() => setStep(2)} onNext={() => setStep(4)} />
                )}
                {step === 4 && (
                    <StepCircle creators={creators} following={following} toggle={v => toggle(following, setFollowing, v)}
                        onBack={() => setStep(3)} onNext={() => setStep(5)} />
                )}
                {step === 5 && (
                    <StepReferral referral={referral} setReferral={setReferral} onBack={() => setStep(4)} onNext={() => setStep(6)} />
                )}
                {step === 6 && (
                    <StepTuned genres={genres} moods={moods} liked={likedSongs} referral={referral}
                        onBack={() => setStep(5)} onFinish={finish} rooms={rooms} />
                )}
            </div>
        </div>
    )
}

export default OnboardingPage
