import { create } from 'zustand';

interface PlayerStore {
    currentSongIndex: number;
    currentTimeMs: number;
    isPlaying: boolean;
    isSynced: boolean;
    // Time-based sync anchor — mirrors server's startTimeUnix
    startTimeUnix: number | null;
    pausedAtMs: number | null;
    // Listener-only: local pause flag (prevents sync checkpoints from resuming)
    listenerLocalPaused: boolean;

    setCurrentSongIndex: (idx: number) => void;
    setCurrentTimeMs: (ms: number) => void;
    setPlaying: (playing: boolean) => void;
    setSynced: (synced: boolean) => void;
    setStartTimeUnix: (ts: number | null) => void;
    setPausedAtMs: (ms: number | null) => void;
    setListenerLocalPaused: (paused: boolean) => void;
    reset: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
    currentSongIndex: 0,
    currentTimeMs: 0,
    isPlaying: false,
    isSynced: true,
    startTimeUnix: null,
    pausedAtMs: null,
    listenerLocalPaused: false,

    setCurrentSongIndex: (currentSongIndex) => set({ currentSongIndex }),
    setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
    setPlaying: (isPlaying) => set({ isPlaying }),
    setSynced: (isSynced) => set({ isSynced }),
    setStartTimeUnix: (startTimeUnix) => set({ startTimeUnix }),
    setPausedAtMs: (pausedAtMs) => set({ pausedAtMs }),
    setListenerLocalPaused: (listenerLocalPaused) => set({ listenerLocalPaused }),
    reset: () => set({
        currentSongIndex: 0,
        currentTimeMs: 0,
        isPlaying: false,
        isSynced: true,
        startTimeUnix: null,
        pausedAtMs: null,
        listenerLocalPaused: false,
    }),
}));
