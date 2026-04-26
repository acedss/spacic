import { Bell, Play } from 'lucide-react'
import { FALLBACK, type RoomData } from './shared'

interface Props {
    featured: RoomData
    onJoin: (id: string) => void
}

export const StationOfTheWeekSection = ({ featured, onJoin }: Props) => (
    <section className="mx-10 my-20 rounded-[28px] overflow-hidden relative ring-1 ring-white/10">
        <img src={featured.playlist[0]?.imageUrl ?? FALLBACK} className="absolute inset-0 w-full h-full object-cover" alt="" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg, oklch(0.1 0.02 285 / 0.9) 30%, oklch(0.1 0.02 285 / 0.4) 70%, transparent 100%)' }} />

        <div className="relative grid grid-cols-12 gap-10 p-14 min-h-[440px]">
            <div className="col-span-7 flex flex-col justify-between">
                <div>
                    <div className="mono text-[10px] uppercase tracking-[0.3em] text-[oklch(0.88_0.12_75)]">Station of the week · Volume 012</div>
                    <h2 className="serif text-white mt-4 italic leading-[0.95]" style={{ fontSize: 72 }}>{featured.title}</h2>
                    <p className="mt-6 text-[16px] text-white/80 max-w-[500px] leading-relaxed">
                        {featured.description || '"A set that begins at 11pm sharp, every Friday. Real listeners, real songs, same second."'}
                        {featured.creatorId?.fullName && ` — hosted by ${featured.creatorId.fullName}.`}
                    </p>
                </div>

                <div className="flex items-center gap-6 mt-10">
                    <button className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-[var(--ink-0)] text-[14px] font-semibold press">
                        <Bell className="size-3.5" /> Set reminder
                    </button>
                    <button onClick={() => onJoin(featured._id)} className="inline-flex items-center gap-2 h-11 px-6 rounded-xl ring-1 ring-white/20 text-white text-[14px] hover:bg-white/8 press">
                        <Play className="size-3.5" /> Join room
                    </button>
                    <span className="mono text-[11px] text-white/50 uppercase tracking-widest">Next set in 02:14:33</span>
                </div>
            </div>

            <div className="col-span-5 flex flex-col gap-4">
                {featured.creatorId && (
                    <div className="rounded-2xl p-5 ring-1 ring-white/10" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            {featured.creatorId.imageUrl && (
                                <img src={featured.creatorId.imageUrl} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/20" alt="" />
                            )}
                            <div className="flex-1">
                                <p className="text-[14px] text-white">{featured.creatorId.fullName}</p>
                                <p className="text-[11px] text-white/50">Creator · 48,210 followers</p>
                            </div>
                            <button className="inline-flex items-center gap-2 h-8 px-3 rounded-xl bg-white text-[var(--ink-0)] text-[12px] font-semibold press">Follow</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {[['Rooms hosted', '142'], ['Listeners reached', '1.2M'], ['Hrs streamed', '890']].map(([l, v]) => (
                                <div key={l} className="p-3 rounded-lg bg-white/5">
                                    <p className="mono text-[9px] uppercase tracking-wider text-white/50">{l}</p>
                                    <p className="mono text-[16px] text-white mt-1 tabular-nums">{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="rounded-2xl p-5 ring-1 ring-white/10" style={{ background: 'oklch(1 0 0 / 0.07)', backdropFilter: 'blur(24px) saturate(200%)' }}>
                    <div className="mono text-[9px] uppercase tracking-widest text-white/50 mb-3">Upcoming</div>
                    {[
                        ['Tonight · 11:00 PM', 'Late Night Lullabies Vol. 13'],
                        ['Sat · 9:00 PM', 'Collab w/ Remy Okafor'],
                        ['Sun · 10:00 AM', 'Slow Sunday'],
                    ].map(([t, title]) => (
                        <div key={t} className="flex items-center gap-3 py-2.5 border-b border-white/8 last:border-0">
                            <span className="mono text-[10px] text-white/60 uppercase tracking-wider w-32">{t}</span>
                            <span className="text-[13px] text-white flex-1">{title}</span>
                            <button className="text-white/50 hover:text-white text-[11px]">+</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </section>
)
