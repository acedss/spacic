import { useEffect, useRef } from 'react';
import { useAudioRef, useSongEndedCallbackRef, usePlayStateCallbackRef } from '@/providers/AudioProvider';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

const AudioPlayer = () => {
    const audioRef = useAudioRef();
    const songEndedCallbackRef = useSongEndedCallbackRef();
    const playStateCallbackRef = usePlayStateCallbackRef();
    const { room, isCreator } = useRoomStore();
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, listenerLocalPaused, setCurrentTimeMs, setListenerLocalPaused } = usePlayerStore();

    // Tracks programmatic seeks (sync correction, song load, drift fix) so
    // onSeeked doesn't re-broadcast them back as room:seek events.
    const skipNextSeekEmitRef = useRef(false);
    // Tracks programmatic pause (from play effect) so onPause doesn't set listenerLocalPaused
    const programmaticPauseRef = useRef(false);
    const prevSongIdRef = useRef<string | null>(null);
    // Whether we *want* the audio playing — used by onCanPlay to auto-play
    // after a new src finishes loading (avoids "interrupted by new load" error)
    const wantPlayRef = useRef(false);

    const currentSong = room?.playlist?.[currentSongIndex];

    // Load new song when track changes OR when audioUrl becomes available
    useEffect(() => {
        if (!audioRef.current || !currentSong?.audioUrl) return;
        prevSongIdRef.current = currentSong._id;

        audioRef.current.src = currentSong.audioUrl;
        skipNextSeekEmitRef.current = true;
        // Use currentTimeMs for all cases:
        //   - New song: 0 (set by room:song_changed) — sync_checkpoint corrects drift within 2s
        //   - URL refresh: preserves live position
        //   - Initial join: server-computed offset from room:joined
        audioRef.current.currentTime = currentTimeMs / 1000;
        // Set wantPlay so onCanPlay fires auto-play when the new src finishes loading.
        // Without this, isPlaying stays true but the play effect doesn't re-run (no dep change),
        // so the new track never starts after song-end advance.
        const { isPlaying: playing, listenerLocalPaused: paused } = usePlayerStore.getState();
        wantPlayRef.current = playing && !paused;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong?._id, currentSong?.audioUrl]);

    // Play / pause driven by store (but respect listener's local pause state)
    useEffect(() => {
        if (!audioRef.current) return;
        // Skip server play/pause commands if listener has locally paused
        if (listenerLocalPaused) {
            wantPlayRef.current = false;
            return;
        }
        if (isPlaying) {
            wantPlayRef.current = true;
            // If audio isn't loaded yet (new src still fetching), defer to onCanPlay.
            // readyState < 2 = HAVE_CURRENT_DATA: calling play() now would be
            // interrupted by the in-flight load, producing the "interrupted" DOMException.
            if (audioRef.current.readyState >= 2) {
                audioRef.current.play().catch((err) => {
                    console.warn('[AudioPlayer] play() failed:', err.message);
                });
            }
        } else {
            wantPlayRef.current = false;
            // Mark as programmatic so onPause doesn't set listenerLocalPaused
            programmaticPauseRef.current = true;
            audioRef.current.pause();
        }
    }, [audioRef, isPlaying, listenerLocalPaused]);

    // Sync correction: isSynced pulses false → seek → back to true
    useEffect(() => {
        if (!audioRef.current || isSynced) return;
        console.log('[AudioPlayer] sync correction seeking to', Math.round(currentTimeMs / 1000), 's');
        skipNextSeekEmitRef.current = true;
        audioRef.current.currentTime = currentTimeMs / 1000;
    }, [audioRef, currentTimeMs, isSynced]);

    return (
        <audio
            ref={audioRef}
            onCanPlay={() => {
                // Audio has buffered enough to play. If we wanted to play but
                // couldn't because the src was still loading, start now.
                if (wantPlayRef.current && !usePlayerStore.getState().listenerLocalPaused) {
                    audioRef.current?.play().catch((err) => {
                        console.warn('[AudioPlayer] onCanPlay play() failed:', err.message);
                    });
                }
            }}
            onTimeUpdate={() => {
                if (!audioRef.current) return;
                const audioMs = audioRef.current.currentTime * 1000;

                // During sync correction (isSynced=false), don't overwrite the
                // target position — the audio element hasn't finished seeking yet
                // and would report the OLD position, reverting the correction.
                const synced = usePlayerStore.getState().isSynced;
                if (synced) {
                    setCurrentTimeMs(audioMs);
                }

                // Drift correction is handled by room:sync_checkpoint (heartbeat)
                // every 5s. Doing it here would conflict with user-initiated seeks
                // and use a stale startTimeUnix after pause/resume.
            }}
            onSeeked={() => {
                // All seeks are local — no broadcasting. skipNextSeekEmitRef kept for future use.
                skipNextSeekEmitRef.current = false;
            }}
            onPlay={() => {
                // Clear local pause flag when user resumes
                setListenerLocalPaused(false);
                // Seek to current server position to sync (mark as programmatic)
                if (audioRef.current && !isCreator) {
                    skipNextSeekEmitRef.current = true;
                    audioRef.current.currentTime = currentTimeMs / 1000;
                }
                // Creators notify socket when starting a song (resume broadcasts startTimeUnix)
                if (isCreator) {
                    playStateCallbackRef.current?.(true);
                }
                // Listeners: pause is local only, no broadcast
            }}
            onPause={() => {
                // Skip if pause was programmatic (from play effect sync)
                if (programmaticPauseRef.current) {
                    programmaticPauseRef.current = false;
                    return;
                }
                // All pause is local — creators' pause doesn't broadcast, listeners' pause doesn't broadcast
                setListenerLocalPaused(true);
            }}
            onEnded={() => {
                songEndedCallbackRef.current?.();
            }}
        />
    );
};

export default AudioPlayer;
