import { ArrowRight } from 'lucide-react';
import type { OnboardingRoom } from './onboarding-shared';

export const StepWelcome = ({ onNext, rooms }: { onNext: () => void; rooms: OnboardingRoom[] }) => {
    const featured = rooms[0];
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
    );
};
