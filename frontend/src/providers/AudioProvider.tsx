import { createContext, useContext, useRef } from 'react';
import type { RefObject, MutableRefObject } from 'react';

interface AudioContextValue {
    audioRef: RefObject<HTMLAudioElement | null>;
    songEndedCallbackRef: MutableRefObject<(() => void) | null>;
    // Called on seek only (isSeeked=true) — no longer called every second
    timeUpdateCallbackRef: MutableRefObject<((currentTimeMs: number, isSeeked?: boolean) => void) | null>;
    // Called when audio element fires onPlay / onPause
    playStateCallbackRef: MutableRefObject<((isPlaying: boolean) => void) | null>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const songEndedCallbackRef = useRef<(() => void) | null>(null);
    const timeUpdateCallbackRef = useRef<((currentTimeMs: number) => void) | null>(null);
    const playStateCallbackRef = useRef<((isPlaying: boolean) => void) | null>(null);
    return (
        <AudioContext.Provider value={{ audioRef, songEndedCallbackRef, timeUpdateCallbackRef, playStateCallbackRef }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudioRef = () => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('useAudioRef must be used within AudioProvider');
    return ctx.audioRef;
};

export const useSongEndedCallbackRef = () => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('useSongEndedCallbackRef must be used within AudioProvider');
    return ctx.songEndedCallbackRef;
};

export const useTimeUpdateCallbackRef = () => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('useTimeUpdateCallbackRef must be used within AudioProvider');
    return ctx.timeUpdateCallbackRef;
};

export const usePlayStateCallbackRef = () => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('usePlayStateCallbackRef must be used within AudioProvider');
    return ctx.playStateCallbackRef;
};
