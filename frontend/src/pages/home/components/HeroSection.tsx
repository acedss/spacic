import { Heart, Play, Radio, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { FALLBACK, getGreeting, type RoomData } from './shared'
import { LiveDot, MiniWave } from './Primitives'

interface Props {
    rooms: RoomData[]
    featured?: RoomData
    loading: boolean
    featuredFav: boolean
    onJoin: (id: string) => void
    onFavorite: () => void
}

export const HeroSection = ({ rooms, featured, loading, featuredFav, onJoin, onFavorite }: Props) => {
    const navigate = useNavigate()
    const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

    return (
        <section className="relative px-10 pt-14 pb-20 overflow-hidden">
            <div className="aurora aurora-breathe" />
            <div className="grain" />

            <div className="relative grid grid-cols-12 gap-10">
                <div className="col-span-7 flex flex-col justify-between" style={{ minHeight: 520 }}>
                    <div>
                        <div className="flex items-center gap-3 mb-10">
                            <span className="mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--fg-3)' }}>
                                Tonight · {todayStr}
                            </span>
                            <span className="w-8 h-px bg-white/15" />
                            <span className="mono text-[10px] uppercase tracking-[0.25em] text-[oklch(0.82_0.17_20)]">
                                Live across {rooms.length > 0 ? `${rooms.length * 34}+` : '412'} rooms
                            </span>
                        </div>

                        <h1 className="serif text-white leading-[0.95] tracking-[-0.02em]"
                            style={{ fontSize: 'clamp(60px, 7.2vw, 108px)' }}>
                            {getGreeting()},<br />
                            <span className="italic opacity-85">the night</span> is<br />
                            <span className="italic" style={{
                                background: 'linear-gradient(100deg, oklch(0.88 0.12 75) 10%, oklch(0.78 0.22 330) 55%, oklch(0.7 0.2 295) 90%)',
                                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                            }}>playing.</span>
                        </h1>

                        <p className="mt-8 text-[18px] leading-relaxed max-w-[520px]" style={{ color: 'var(--fg-1)' }}>
                            Drop into a live room where real people are listening to the same song, at the same second — from Berlin to Lagos to your couch.
                        </p>

                        <div className="flex items-center gap-3 mt-8">
                            <button onClick={() => navigate('/rooms')}
                                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press">
                                <Play className="size-3.5" /> Tune in · Live tonight
                            </button>
                            <button onClick={() => navigate('/studio')}
                                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/15 text-white text-[14px] hover:bg-white/4 press">
                                <Radio className="size-3.5" /> Host a room
                            </button>
                        </div>
                    </div>

                    {featured && (
                        <div className="mt-10 pt-6 border-t hair flex items-center gap-6">
                            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Now playing</span>
                            <MiniWave count={28} />
                            <span className="text-[13px] text-white truncate">
                                {featured.playlist[0]?.title ?? featured.title}
                                {' '}
                                <span style={{ color: 'var(--fg-3)' }}>— {featured.playlist[0]?.artist ?? featured.creatorId?.fullName}</span>
                            </span>
                        </div>
                    )}
                </div>

                <div className="col-span-5">
                    {loading ? (
                        <Skeleton className="w-full aspect-[4/5] rounded-2xl bg-white/5" />
                    ) : featured ? (
                        <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10" style={{ aspectRatio: '4/5' }}>
                            <img src={featured.playlist[0]?.imageUrl ?? FALLBACK} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, oklch(0.08 0.015 285 / 0.85) 100%)' }} />

                            <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                                <div className="flex flex-col gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-[oklch(0.72_0.22_20_/_0.15)] text-[oklch(0.82_0.17_20)] ring-1 ring-[oklch(0.72_0.22_20_/_0.4)]">
                                        <LiveDot /> {featured.listenerCount.toLocaleString()} listening
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 bg-black/70 text-white/90 ring-1 ring-white/15">
                                        Featured · Pre-release
                                    </span>
                                </div>
                                <button onClick={onFavorite}
                                    className="h-9 w-9 rounded-full grid place-items-center bg-white/10 backdrop-blur ring-1 ring-white/20 press">
                                    <Heart className={`size-3.5 ${featuredFav ? 'fill-red-400 text-red-400' : 'text-white'}`} />
                                </button>
                            </div>

                            <div className="absolute left-0 right-0 bottom-0 p-6">
                                {featured.creatorId && (
                                    <div className="flex items-center gap-2 mb-2">
                                        {featured.creatorId.imageUrl && (
                                            <img src={featured.creatorId.imageUrl} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20" alt="" />
                                        )}
                                        <span className="text-[12px] text-white/90">{featured.creatorId.fullName}</span>
                                        <span className="text-[11px] text-white/50">hosting</span>
                                    </div>
                                )}
                                <h3 className="serif text-[36px] leading-[1.05] text-white">{featured.title}</h3>
                                {featured.description && (
                                    <p className="text-[13px] text-white/70 mt-1 line-clamp-2 max-w-[320px]">{featured.description}</p>
                                )}
                                <div className="mt-4">
                                    <button onClick={() => onJoin(featured._id)}
                                        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-[var(--ink-0)] text-[13px] font-semibold press">
                                        <Play className="size-3" /> Join
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative rounded-2xl ring-1 ring-white/8 flex items-center justify-center text-center p-12"
                            style={{ aspectRatio: '4/5', background: 'var(--ink-2)' }}>
                            <div>
                                <Radio className="size-10 mx-auto mb-4 opacity-30 text-white" />
                                <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>No live rooms right now</p>
                                <button onClick={() => navigate('/studio')} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">
                                    <Zap className="size-3" /> Start one
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
