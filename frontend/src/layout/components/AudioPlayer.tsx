import { useEffect, useRef } from 'react';
import { useAudioRef, useSongEndedCallbackRef, useTimeUpdateCallbackRef, usePlayStateCallbackRef } from '@/providers/AudioProvider';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

const AudioPlayer = () => {
    const audioRef = useAudioRef();
    const songEndedCallbackRef = useSongEndedCallbackRef();
    const timeUpdateCallbackRef = useTimeUpdateCallbackRef();
    const playStateCallbackRef = usePlayStateCallbackRef();
    const { room } = useRoomStore();
    const { currentSongIndex, currentTimeMs, isPlaying, isSynced, setCurrentTimeMs } = usePlayerStore();

    // Tracks programmatic seeks (sync correction, song load, drift fix) so
    // onSeeked doesn't re-broadcast them back as room:seek events.
    const skipNextSeekEmitRef = useRef(false);
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
        if (isPlaying) audioRef.current.play().catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong?._id, currentSong?.audioUrl]);

    // Play / pause driven by store
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.play().catch(() => { });
        else audioRef.current.pause();
    }, [audioRef, isPlaying]);

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
                if (!audioRef.current) return;
                // Programmatic seek (sync correction / drift fix / force-seek from room:sync)
                if (skipNextSeekEmitRef.current) {
                    skipNextSeekEmitRef.current = false;
                    return;
                }
                // Also skip if we're in the middle of a sync correction window
                // (room:sync force-seeked audio, isSynced is still false)
                if (!usePlayerStore.getState().isSynced) return;
                // User-initiated seek — broadcast new position to room
                const ms = audioRef.current.currentTime * 1000;
                console.log('[AudioPlayer] onSeeked → broadcasting room:seek at', Math.round(ms), 'ms');
                timeUpdateCallbackRef.current?.(ms, true);
            }}
            onPlay={() => {
                // Notify useRoomSocket that creator resumed playback
                playStateCallbackRef.current?.(true);
            }}
            onPause={() => {
                // Notify useRoomSocket that creator paused playback
                playStateCallbackRef.current?.(false);
            }}
            onEnded={() => {
                songEndedCallbackRef.current?.();
            }}
        />
    );
};

export default AudioPlayer;
