import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { useAudioRef, useSongEndedCallbackRef, useTimeUpdateCallbackRef, usePlayStateCallbackRef } from '@/providers/AudioProvider';
import { useAuthStore } from '@/stores/useAuthStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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
    useAuthStore(); // subscribes to auth state; isAdmin accessed via .getState() in callbacks
    const walletStore = useWalletStore();
    const audioRef = useAudioRef();
    const songEndedCallbackRef = useSongEndedCallbackRef();
    const timeUpdateCallbackRef = useTimeUpdateCallbackRef();
    const playStateCallbackRef = usePlayStateCallbackRef();

    const emit = useCallback((event: string, data: Record<string, unknown>) => {
        socketRef.current?.emit(event, data);
    }, []);

    const sendChat = useCallback((message: string) => {
        emit('room:chat', { roomId, message });
    }, [roomId, emit]);

    const skipSong = useCallback(() => {
        emit('room:skip', { roomId, clerkId: userId });
    }, [roomId, userId, emit]);

    const leaveRoom = useCallback(() => {
        emit('room:leave', { roomId, clerkId: userId });
        socketRef.current?.disconnect();
    }, [roomId, userId, emit]);

    const donate = useCallback((amount: number) => {
        // Generate UUID here (before emit) so retries reuse the same key
        const idempotencyKey = crypto.randomUUID();
        emit('room:donate', { roomId, amount, idempotencyKey });
    }, [roomId, emit]);

    const updateGoal = useCallback((newGoal: number) => {
        emit('room:update_goal', { roomId, newGoal });
    }, [roomId, emit]);

    useEffect(() => {
        if (!userId || !roomId) return;

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
            socket.emit(event, { roomId });
        };

        socket.on('connect', () => {
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

                playerStore.setCurrentTimeMs(positionMs);
                playerStore.setSynced(false);

                // Force-seek audio element directly — bypasses store→effect race
                if (audioRef.current) {
                    audioRef.current.currentTime = positionMs / 1000;
                }
                // 1200ms on join: covers URL state update → React re-render →
                // AudioPlayer song-load effect → audio.play() → onPlay event chain.
                // Shorter (400ms) is enough for sync events that don't change src.
                setTimeout(() => {
                    playerStore.setSynced(true);
                    syncInProgressRef.current = false;
                }, 1200);

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
            }
            setTimeout(() => {
                playerStore.setSynced(true);
                syncInProgressRef.current = false;
            }, 400);
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

            if (drift > 300) {
                playerStore.setCurrentTimeMs(expectedMs);
                playerStore.setSynced(false);
                if (audioRef.current) {
                    audioRef.current.currentTime = expectedMs / 1000;
                }
                setTimeout(() => playerStore.setSynced(true), 400);
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
            song?: { _id: string; title: string; artist: string; duration: number; imageUrl?: string; s3Key: string; albumId?: string | null };
            songPresignedUrl?: string;
            startTimeUnix: number;
            serverTimestamp?: number;
        }) => {
            syncInProgressRef.current = true;
            // Block onTimeUpdate from overwriting position with stale audio data
            playerStore.setSynced(false);

            // If the new song index is beyond the current playlist, append it
            const currentPlaylist = useRoomStore.getState().room?.playlist;
            if (song && currentPlaylist && songIndex >= currentPlaylist.length) {
                const newSong = { ...song, audioUrl: songPresignedUrl || '', albumId: song.albumId ?? null, imageUrl: song.imageUrl ?? '' };
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
            }, 400);
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

        socket.on('room:offline', () => {
            const current = roomStore.room;
            if (current) roomStore.setRoom({ ...current, status: 'offline' });
            playerStore.setPlaying(false);
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        });

        socket.on('wallet:balance_updated', ({ balance }: { balance: number }) => {
            walletStore.setBalance(balance);
        });

        socket.on('room:goal_updated', ({ streamGoal, streamGoalCurrent }: {
            roomId: string;
            streamGoal: number;
            streamGoalCurrent: number;
            donor: { name: string; amount: number };
        }) => {
            const current = roomStore.room;
            if (current) roomStore.setRoom({ ...current, streamGoal, streamGoalCurrent });
        });

        socket.on('room:playlist_updated', ({ playlist }: { playlist: Array<{ _id: string; title: string; artist: string; duration: number; imageUrl: string; s3Key: string; albumId: string | null }> }) => {
            const current = useRoomStore.getState().room;
            if (current) {
                roomStore.setRoom({ ...current, playlist: playlist.map(s => ({ ...s, audioUrl: '' })) });
            }
        });

        socket.on('room:goal_reached', () => {
            // room:goal_updated already set the correct streamGoalCurrent before this fires.
            // Nothing to override here — this event is just a trigger for UI celebrations.
        });

        socket.on('room:error', ({ message }: { message: string }) => {
            console.error('[Socket] << RECV room:error |', message);
            roomStore.setError(message);
        });

        socket.on('reconnect', () => {
            // Only creators need to announce reconnect — listeners just re-join normally
            const { isCreator } = useRoomStore.getState();
            if (isCreator) {
                socket.emit('room:creator_reconnect', { roomId, clerkId: userId });
            } else {
                socket.emit('room:join', { roomId, clerkId: userId });
            }
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

    return { sendChat, skipSong, leaveRoom, donate, updateGoal };
};
