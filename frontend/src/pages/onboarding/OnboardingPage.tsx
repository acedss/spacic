import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { axiosInstance } from '@/lib/axios';
import { Progress } from './components/onboarding-atoms';
import { StepWelcome } from './components/StepWelcome';
import { StepTaste } from './components/StepTaste';
import { StepMood } from './components/StepMood';
import { StepSongs } from './components/StepSongs';
import { StepCircle } from './components/StepCircle';
import { StepReferral } from './components/StepReferral';
import { StepTuned } from './components/StepTuned';
import {
    TOTAL_STEPS, type GenreId,
    type OnboardingCreator, type OnboardingRoom, type OnboardingSong,
} from './components/onboarding-shared';

const OnboardingPage = () => {
    useUser();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [genres, setGenres] = useState<Set<GenreId>>(new Set(['ambient', 'lofi']));
    const [moods, setMoods] = useState<Set<string>>(new Set(['Late Night']));
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
    const [dislikedSongs, setDislikedSongs] = useState<Set<string>>(new Set());
    const [referral, setReferral] = useState('');
    const [songs, setSongs] = useState<OnboardingSong[]>([]);
    const [creators, setCreators] = useState<OnboardingCreator[]>([]);
    const [rooms, setRooms] = useState<OnboardingRoom[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        axiosInstance.get('/auth/onboarding/data')
            .then(({ data }) => {
                setSongs(data.songs ?? []);
                setCreators(data.creators ?? []);
                setRooms(data.rooms ?? []);
            })
            .catch(() => { });
    }, []);

    const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, val: T) => {
        const n = new Set(set);
        if (n.has(val)) n.delete(val);
        else n.add(val);
        setter(n);
    };

    const handleLike = (id: string) => {
        const n = new Set(likedSongs);
        if (n.has(id)) { n.delete(id); } else { n.add(id); dislikedSongs.delete(id); setDislikedSongs(new Set(dislikedSongs)); }
        setLikedSongs(n);
    };

    const handleDislike = (id: string) => {
        const n = new Set(dislikedSongs);
        if (n.has(id)) { n.delete(id); } else { n.add(id); likedSongs.delete(id); setLikedSongs(new Set(likedSongs)); }
        setDislikedSongs(n);
    };

    const finish = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await axiosInstance.post('/auth/onboarding/complete', {
                genres: [...genres],
                moods: [...moods],
                likedSongIds: [...likedSongs],
                dislikedSongIds: [...dislikedSongs],
                referralUsername: referral || undefined,
            });
        } catch { /* onboarding still completes locally */ }
        setSubmitting(false);
        navigate('/');
    };

    const skip = async () => {
        try { await axiosInstance.post('/auth/onboarding/complete'); } catch { /* skip is best-effort */ }
        navigate('/');
    };

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
    );
};

export default OnboardingPage;
