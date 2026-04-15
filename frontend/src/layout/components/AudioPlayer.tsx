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
        // Don't auto-play here — let the play/pause effect handle it
        // (prevents race where we play stale position before sync completes)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong?._id, currentSong?.audioUrl]);

    // Play / pause driven by store (but respect listener's local pause state)
    useEffect(() => {
        if (!audioRef.current) return;
        // Skip server play/pause commands if listener has locally paused
        if (listenerLocalPaused) return;
        if (isPlaying) {
            audioRef.current.play().catch((err) => {
                console.warn('[AudioPlayer] play() failed:', err.message);
            });
        } else {
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
