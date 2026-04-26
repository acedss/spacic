import { Play, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { OnboardingSong } from './onboarding-shared';
import { StepFooter, StepHead } from './onboarding-atoms';

export const StepSongs = ({ songs, liked, disliked, onLike, onDislike, onBack, onNext }: {
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
                const isLiked = liked.has(song._id);
                const isDisliked = disliked.has(song._id);
                return (
                    <div key={song._id}
                        className={`flex items-center gap-3 p-3 rounded-xl ring-1 transition-all ${isLiked ? 'ring-[oklch(0.74_0.14_160)] bg-[oklch(0.74_0.14_160_/_0.08)]'
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
                                className={`w-8 h-8 rounded-lg grid place-items-center press transition-all ${isDisliked ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' : 'hover:bg-white/8 text-white/30 hover:text-white/60'
                                    }`}>
                                <ThumbsDown className="size-3.5" />
                            </button>
                            <button onClick={() => onLike(song._id)}
                                className={`w-8 h-8 rounded-lg grid place-items-center press transition-all ${isLiked ? 'bg-[oklch(0.74_0.14_160_/_0.2)] text-[oklch(0.74_0.14_160)] ring-1 ring-[oklch(0.74_0.14_160_/_0.3)]' : 'hover:bg-white/8 text-white/30 hover:text-white/60'
                                    }`}>
                                <ThumbsUp className="size-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
        <StepFooter selected={liked.size + disliked.size} min={3} onBack={onBack} onNext={onNext} />
    </div>
);
