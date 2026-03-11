import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAudioRef, useSongEndedCallbackRef, useTimeUpdateCallbackRef, usePlayStateCallbackRef } from '@/providers/AudioProvider';
import { useAuthStore } from '@/stores/useAuthStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// TODO(human): Implement this function.
// It receives the sync payload from the server (room:sync or room:joined) and
// must return the correct currentPositionMs for the audio element to seek to.
//
// Parameters:
//   isPlaying    — whether the room is currently playing
//   startTimeUnix — the server's wall-clock anchor (ms). When isPlaying=true:
//                   currentPosition = (Date.now() - startTimeUnix) - networkLatencyMs
//   pausedAtMs   — frozen position when paused. When isPlaying=false, return this directly.
//   serverTimestamp — when the server sent this packet (ms). Use to estimate latency:
//                   networkLatencyMs ≈ Date.now() - serverTimestamp
//
// Hint from the user's formula: ActualPosition = (Now - StartTime) - Latency
// Clamp the result to >= 0 to handle clock skew.
export const computePositionFromSync = (
    isPlaying: boolean,
    startTimeUnix: number | null,
    pausedAtMs: number | null,
    serverTimestamp: number,
): number => {
    if (!isPlaying) return pausedAtMs ?? 0;
    if (startTimeUnix === null) return 0;
    const networkLatencyMs = Date.now() - serverTimestamp;
    const elapsed = Date.now() - startTimeUnix;
    return Math.max(0, elapsed - networkLatencyMs);
};

export const useRoomSocket = (roomId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Prevents onPlay/onPause from re-emitting room:resume/room:pause
    // while the frontend is processing an incoming room:sync event.
    const syncInProgressRef = useRef(false);
    const { userId } = useAuth();

    const roomStore = useRoomStore();
    const playerStore = usePlayerStore();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isAdmin } = useAuthStore();
    const audioRef = useAudioRef();
    const songEndedCallbackRef = useSongEndedCallbackRef();
    const timeUpdateCallbackRef = useTimeUpdateCallbackRef();
    const playStateCallbackRef = usePlayStateCallbackRef();

    const emit = useCallback((event: string, data: Record<string, unknown>) => {
        socketRef.current?.emit(event, data);
    }, []);

    const sendChat = useCallback((message: string) => {
        console.log('[Chat] >> SEND room:chat');
        emit('room:chat', { roomId, message });
    }, [roomId, emit]);

    const skipSong = useCallback(() => {
        emit('room:skip', { roomId, clerkId: userId });
    }, [roomId, userId, emit]);

    const leaveRoom = useCallback(() => {
        emit('room:leave', { roomId, clerkId: userId });
        socketRef.current?.disconnect();
    }, [roomId, userId, emit]);

    useEffect(() => {
        if (!userId) return;

        socketRef.current = io(SOCKET_URL, {
            auth: { clerkId: userId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling'],
        });

        const socket = socketRef.current;

        // Register song-ended callback so AudioPlayer can trigger auto-advance
        songEndedCallbackRef.current = () => {
            socket.emit('room:song_ended', {
                roomId,
                clerkId: userId,
                currentSongIndex: usePlayerStore.getState().currentSongIndex,
            });
        };

        // Seek-only callback — emits room:seek with new position anchor
        timeUpdateCallbackRef.current = (currentTimeMs: number, isSeeked = false) => {
            const { isCreator } = useRoomStore.getState();
            const { isAdmin: adminNow } = useAuthStore.getState();
            if (!isSeeked || (!isCreator && !adminNow)) return;
            console.log(`[Socket] >> SEND room:seek | positionMs=${Math.round(currentTimeMs)} isCreator=${isCreator} isAdmin=${adminNow}`);
            socket.emit('room:seek', { roomId, seekPositionMs: currentTimeMs });
        };

        // Play/pause callback — creator's audio element fires onPlay/onPause
        playStateCallbackRef.current = (isPlaying: boolean) => {
            const { isCreator } = useRoomStore.getState();
            const { isAdmin: adminNow } = useAuthStore.getState();
            if (!isCreator && !adminNow) return;
            // Don't re-emit when triggered by incoming room:sync
            if (syncInProgressRef.current) return;
            const event = isPlaying ? 'room:resume' : 'room:pause';
            console.log(`[Socket] >> SEND ${event} | room=${roomId}`);
            socket.emit(event, { roomId });
        };

        socket.on('connect', () => {
            console.log(`[Socket] >> SEND room:join | room=${roomId} clerkId=${userId}`);
            socket.emit('room:join', { roomId, clerkId: userId });
        });

        socket.on('room:joined', ({ isCreator, playback, listenerCount, serverTimestamp }: {
            isCreator: boolean;
            playback?: {
                isPlaying: boolean;
                startTimeUnix: number | null;
                pausedAtMs: number | null;
                currentSongPresignedUrl?: string;
            };
            listenerCount: number;
            serverTimestamp: number;
        }) => {
            console.log('[Socket] << RECV room:joined', { isCreator, listenerCount });
            roomStore.setIsCreator(isCreator);
            roomStore.setListenerCount(listenerCount);
            if (playback) {
                syncInProgressRef.current = true;
                playerStore.setPlaying(playback.isPlaying);
                playerStore.setStartTimeUnix(playback.startTimeUnix);
                playerStore.setPausedAtMs(playback.pausedAtMs);

                const positionMs = computePositionFromSync(
                    playback.isPlaying,
                    playback.startTimeUnix,
                    playback.pausedAtMs,
                    serverTimestamp,
                );

                console.table({
                    event: 'room:joined',
                    isPlaying: playback.isPlaying,
                    startTimeUnix: playback.startTimeUnix,
                    serverTimestamp,
                    latencyMs: Date.now() - serverTimestamp,
                    computedPositionMs: Math.round(positionMs),
                });

                playerStore.setCurrentTimeMs(positionMs);
                playerStore.setSynced(false);

                // Force-seek audio element directly — bypasses store→effect race
                if (audioRef.current) {
                    audioRef.current.currentTime = positionMs / 1000;
                    console.log('[Socket] Force-seek audio to', Math.round(positionMs), 'ms');
                }
                setTimeout(() => {
                    playerStore.setSynced(true);
                    syncInProgressRef.current = false;
                }, 200);

                if (playback.currentSongPresignedUrl) {
                    roomStore.updatePlaylistSongUrl(
                        usePlayerStore.getState().currentSongIndex,
                        playback.currentSongPresignedUrl,
                    );
                }
            }
        });

        socket.on('room:listener_joined', ({ listenerCount }: { listenerCount: number }) => {
            roomStore.setListenerCount(listenerCount);
        });

        socket.on('room:listener_left', ({ listenerCount }: { listenerCount: number }) => {
            roomStore.setListenerCount(listenerCount);
        });

        // Single SYNC_EVENT: handles play, pause, seek, resume
        socket.on('room:sync', ({
            isPlaying,
            startTimeUnix,
            pausedAtMs,
            serverTimestamp,
            listenerCount,
        }: {
            isPlaying: boolean;
            startTimeUnix?: number | null;
            pausedAtMs?: number | null;
            serverTimestamp: number;
            listenerCount?: number;
        }) => {
            syncInProgressRef.current = true;

            const positionMs = computePositionFromSync(
                isPlaying,
                startTimeUnix ?? null,
                pausedAtMs ?? null,
                serverTimestamp,
            );

            console.log('[Socket] << RECV room:sync');
            console.table({
                event: 'room:sync',
                isPlaying,
                startTimeUnix,
                pausedAtMs,
                serverTimestamp,
                clientNow: Date.now(),
                latencyMs: Date.now() - serverTimestamp,
                computedPositionMs: Math.round(positionMs),
                audioCurrentMs: audioRef.current ? Math.round(audioRef.current.currentTime * 1000) : null,
            });

            playerStore.setPlaying(isPlaying);
            if (startTimeUnix !== undefined) playerStore.setStartTimeUnix(startTimeUnix ?? null);
            if (pausedAtMs !== undefined) playerStore.setPausedAtMs(pausedAtMs ?? null);
            if (listenerCount !== undefined) roomStore.setListenerCount(listenerCount);

            playerStore.setCurrentTimeMs(positionMs);
            playerStore.setSynced(false);

            // Force-seek audio element directly — bypasses the store→effect→onTimeUpdate race.
            // Without this, onTimeUpdate overwrites currentTimeMs with the OLD position
            // before the useEffect sync correction can fire.
            if (audioRef.current) {
                audioRef.current.currentTime = positionMs / 1000;
                console.log('[Socket] Force-seek audio to', Math.round(positionMs), 'ms');
            }
            setTimeout(() => {
                playerStore.setSynced(true);
                syncInProgressRef.current = false;
            }, 200);
        });

        // Lightweight heartbeat — re-anchors any client that drifted
        socket.on('room:sync_checkpoint', ({
            startTimeUnix,
            pausedAtMs,
            isPlaying,
            serverTimestamp,
            listenerCount,
        }: {
            startTimeUnix: number | null;
            pausedAtMs: number | null;
            isPlaying: boolean;
            serverTimestamp: number;
            listenerCount?: number;
        }) => {
            if (listenerCount !== undefined) roomStore.setListenerCount(listenerCount);

            const expectedMs = computePositionFromSync(isPlaying, startTimeUnix, pausedAtMs, serverTimestamp);
            const liveTimeMs = audioRef.current ? audioRef.current.currentTime * 1000 : usePlayerStore.getState().currentTimeMs;
            const drift = Math.abs(liveTimeMs - expectedMs);

            console.table({
                event: 'sync_checkpoint',
                expectedMs: Math.round(expectedMs),
                audioMs: Math.round(liveTimeMs),
                drift: Math.round(drift),
                correcting: drift > 500,
                latencyMs: Date.now() - serverTimestamp,
            });

            if (drift > 500) {
                console.log(`[Sync] Drift detected: ${Math.round(drift)}ms. Correcting...`);
                playerStore.setCurrentTimeMs(expectedMs);
                playerStore.setSynced(false);
                if (audioRef.current) {
                    audioRef.current.currentTime = expectedMs / 1000;
                }
                setTimeout(() => playerStore.setSynced(true), 200);
            }
        });

        socket.on('room:song_changed', ({
            songIndex,
            song,
            songPresignedUrl,
            startTimeUnix,
            serverTimestamp,
        }: {
            songIndex: number;
            song?: { _id: string; title: string; artist: string; duration: number; imageUrl?: string; s3Key: string };
            songPresignedUrl?: string;
            startTimeUnix: number;
            serverTimestamp: number;
        }) => {
            syncInProgressRef.current = true;
            // Block onTimeUpdate from overwriting position with stale audio data
            playerStore.setSynced(false);

            // If the new song index is beyond the current playlist, append it
            const currentPlaylist = useRoomStore.getState().room?.playlist;
            if (song && currentPlaylist && songIndex >= currentPlaylist.length) {
                const newSong = { ...song, audioUrl: songPresignedUrl || '' };
                roomStore.setRoom({
                    ...useRoomStore.getState().room!,
                    playlist: [...currentPlaylist, newSong],
                });
            } else if (songPresignedUrl) {
                roomStore.updatePlaylistSongUrl(songIndex, songPresignedUrl);
            }

            playerStore.setCurrentSongIndex(songIndex);
            playerStore.setStartTimeUnix(startTimeUnix);
            playerStore.setPausedAtMs(null);
            playerStore.setCurrentTimeMs(0);
            playerStore.setPlaying(true);

            setTimeout(() => {
                playerStore.setSynced(true);
                syncInProgressRef.current = false;
            }, 200);
        });

        socket.on('room:chat_message', (msg) => {
            console.log('[Chat] << RECV room:chat_message', msg);
            roomStore.addChatMessage(msg);
        });

        socket.on('room:creator_disconnected', ({ countdownSeconds }: { countdownSeconds: number }) => {
            playerStore.setPlaying(false);
            roomStore.setCreatorDisconnectCountdown(countdownSeconds);

            let remaining = countdownSeconds;
            countdownRef.current = setInterval(() => {
                remaining -= 1;
                roomStore.setCreatorDisconnectCountdown(remaining);
                if (remaining <= 0 && countdownRef.current) {
                    clearInterval(countdownRef.current);
                    countdownRef.current = null;
                }
            }, 1000);
        });

        socket.on('room:creator_reconnected', () => {
            roomStore.setCreatorDisconnectCountdown(null);
            playerStore.setPlaying(true);
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        });

        socket.on('room:closed', () => {
            const current = roomStore.room;
            if (current) roomStore.setRoom({ ...current, status: 'closed' });
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        });

        socket.on('room:error', ({ message }: { message: string }) => {
            console.error('[Socket] << RECV room:error |', message);
            roomStore.setError(message);
        });

        socket.on('reconnect', () => {
            socket.emit('room:creator_reconnect', { roomId, clerkId: userId });
        });

        return () => {
            songEndedCallbackRef.current = null;
            timeUpdateCallbackRef.current = null;
            playStateCallbackRef.current = null;
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.emit('room:leave', { roomId, clerkId: userId });
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, userId]);

    return { sendChat, skipSong, leaveRoom };
};
