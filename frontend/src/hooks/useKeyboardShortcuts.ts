// Global keyboard shortcuts. Single window-level listener avoids handler
// races. Skips events when focus is inside an input/textarea/contenteditable
// so users can still type "k" in chat without pausing audio.
import { useEffect } from 'react';
import { useAudioRef } from '@/providers/AudioProvider';
import { usePlayerStore } from '@/stores/usePlayerStore';

interface ShortcutHandlers {
    onSearch?: () => void;
    onHelp?:   () => void;
}

const isTypingTarget = (el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
};

export const useKeyboardShortcuts = ({ onSearch, onHelp }: ShortcutHandlers) => {
    const audioRef = useAudioRef();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K — search palette (works everywhere, even in inputs)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                onSearch?.();
                return;
            }

            // Suppress single-key shortcuts while typing
            if (isTypingTarget(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            const audio = audioRef.current;
            switch (e.key) {
                case ' ':
                    if (!audio) return;
                    e.preventDefault();
                    if (audio.paused) audio.play().catch(() => {});
                    else audio.pause();
                    break;
                case 'm':
                case 'M':
                    if (!audio) return;
                    audio.muted = !audio.muted;
                    break;
                case 'j':
                case 'J':
                    if (!audio) return;
                    audio.currentTime = Math.max(0, audio.currentTime - 5);
                    break;
                case 'l':
                case 'L':
                    if (!audio) return;
                    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
                    break;
                case '?':
                    e.preventDefault();
                    onHelp?.();
                    break;
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [audioRef, onSearch, onHelp]);
};

// Static list — used by the help overlay so docs and behavior never drift.
export const SHORTCUT_GROUPS = [
    {
        title: 'Playback',
        items: [
            { keys: ['Space'], desc: 'Play / pause' },
            { keys: ['J'],     desc: 'Rewind 5s' },
            { keys: ['L'],     desc: 'Forward 5s' },
            { keys: ['M'],     desc: 'Mute / unmute' },
        ],
    },
    {
        title: 'Navigation',
        items: [
            { keys: ['⌘', 'K'], desc: 'Quick search' },
            { keys: ['?'],      desc: 'Show this help' },
        ],
    },
];

// Note on the player store import — kept available so future shortcuts
// (e.g. next/prev track) can dispatch actions without touching the audio
// element directly.  The current set only touches the DOM element.
void usePlayerStore;
