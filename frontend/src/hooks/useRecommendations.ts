import { useState, useEffect, useRef } from 'react';
import { getMyRecommendations, getTrendingSongs } from '@/lib/recsService';
import type { RecRoom, TrendingSong, RecsResult } from '@/lib/recsService';

interface State {
    recs:      RecsResult | null;
    trending:  TrendingSong[];
    isLoading: boolean;
    error:     string | null;
}

export const useRecommendations = () => {
    const [state, setState] = useState<State>({
        recs:      null,
        trending:  [],
        isLoading: true,
        error:     null,
    });
    const [tick, setTick] = useState(0);
    const cancelRef = useRef(false);

    useEffect(() => {
        cancelRef.current = false;

        Promise.all([getMyRecommendations(20), getTrendingSongs()])
            .then(([recs, trending]) => {
                if (!cancelRef.current) {
                    setState({ recs, trending, isLoading: false, error: null });
                }
            })
            .catch(() => {
                if (!cancelRef.current) {
                    setState(prev => ({ ...prev, isLoading: false, error: 'Could not load recommendations' }));
                }
            });

        return () => { cancelRef.current = true; };
    }, [tick]);

    return {
        forYou:    state.recs?.rooms  ?? [] as RecRoom[],
        trending:  state.trending,
        source:    state.recs?.source ?? null,
        isLoading: state.isLoading,
        error:     state.error,
        refresh:   () => { setState(prev => ({ ...prev, isLoading: true, error: null })); setTick(t => t + 1); },
    };
};
