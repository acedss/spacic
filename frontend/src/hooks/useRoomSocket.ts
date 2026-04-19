import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/stores/useRoomStore';
import type { Nomination, SessionInfo } from '@/stores/useRoomStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { useAudioRef, useSongEndedCallbackRef, usePlayStateCallbackRef } from '@/providers/AudioProvider';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ActiveGame } from '@/types/types.tsx';
import { toast } from 'sonner';

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

    const submitAnswer = useCallback((minigameId: string, answer: string) => {
        emit('room:game_answer', { roomId, minigameId, answer });
    }, [roomId, emit]);

    const voteSkip = useCallback(() => {
        emit('room:vote_skip', { roomId });
    }, [roomId, emit]);

    const reactToSong = useCallback((reaction: 'like' | 'dislike') => {
        emit('room:song_reaction', { roomId, reaction });
    }, [roomId, emit]);

    const sendEmoji = useCallback((emoji: string) => {
        emit('room:emoji', { roomId, emoji });
    }, [roomId, emit]);

    const nominateSong = useCallback((songId: string) => {
        emit('room:nominate_song', { roomId, songId });
    }, [roomId, emit]);

    const voteForSong = useCallback((songId: string) => {
        emit('room:vote_queue', { roomId, songId });
    }, [roomId, emit]);

    const pinMessage = useCallback((messageId: string, message: string, userId: string, userName: string) => {
        emit('room:pin_message', { roomId, messageId, message, userId, userName });
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

        // Play callback — creator notifies room when they start playing a song
        // (pause is local only, doesn't broadcast)
        playStateCallbackRef.current = (isPlaying: boolean) => {
            const { isCreator } = useRoomStore.getState();
            const { isAdmin: adminNow } = useAuthStore.getState();
            if (!isCreator && !adminNow) return;
            // Don't re-emit when triggered by incoming room:sync
            if (syncInProgressRef.current) return;
            // Only emit when creator plays (pause is local)
            if (isPlaying) {
                socket.emit('room:resume', { roomId });
            }
        };

        socket.on('connect', () => {
            socket.emit('room:join', { roomId, clerkId: userId });
        });

        socket.on('room:joined', ({ isCreator, playback, listenerCount, serverTimestamp, activeGame, sessionInfo, reactions, skipVotes }: {
            isCreator: boolean;
            playback?: {
                isPlaying: boolean;
                startTimeUnix: number | null;
                pausedAtMs: number | null;
                currentSongPresignedUrl?: string;
            };
            listenerCount: number;
            serverTimestamp: number;
            activeGame?: ActiveGame | null;
            sessionInfo?: SessionInfo | null;
            reactions?: { likes: number; dislikes: number };
            skipVotes?: { count: number; needed: number };
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

            // Populate voting & session state
            if (sessionInfo) roomStore.setSessionInfo(sessionInfo);
            if (reactions) roomStore.setReactions(reactions);
            if (skipVotes) roomStore.setSkipVotes(skipVotes);
            // Fetch current nominations
            socket.emit('room:get_nominations', { roomId });

            // If a game was running when we joined, populate listener game state
            if (activeGame && !isCreator) {
                roomStore.setActiveGame(activeGame);
                const secs = activeGame.endsAt
                    ? Math.max(0, Math.ceil((new Date(activeGame.endsAt).getTime() - Date.now()) / 1000))
                    : activeGame.durationSeconds;
                roomStore.setGameSecondsLeft(secs);
                const tick = setInterval(() => {
                    const cur = useRoomStore.getState().gameSecondsLeft;
                    if (cur <= 1) { clearInterval(tick); roomStore.setGameSecondsLeft(0); }
                    else roomStore.setGameSecondsLeft(cur - 1);
                }, 1000);
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
            const { listenerLocalPaused } = usePlayerStore.getState();

            const positionMs = computePositionFromSync(
                isPlaying,
                startTimeUnix ?? null,
                pausedAtMs ?? null,
                serverTimestamp,
            );

            // Update playback state from server
            playerStore.setPlaying(isPlaying);
            if (startTimeUnix !== undefined) playerStore.setStartTimeUnix(startTimeUnix ?? null);
            if (pausedAtMs !== undefined) playerStore.setPausedAtMs(pausedAtMs ?? null);
            if (listenerCount !== undefined) roomStore.setListenerCount(listenerCount);

            playerStore.setCurrentTimeMs(positionMs);
            playerStore.setSynced(false);

            // Force-seek audio element directly — bypasses the store→effect→onTimeUpdate race.
            // Without this, onTimeUpdate overwrites currentTimeMs with the OLD position
            // before the useEffect sync correction can fire.
            // But skip if listener has locally paused (let them stay at their pause position)
            if (audioRef.current && !listenerLocalPaused) {
                audioRef.current.currentTime = positionMs / 1000;
            }
            setTimeout(() => {
                playerStore.setSynced(true);
                syncInProgressRef.current = false;
            }, 400);
        });

        // Lightweight heartbeat — updates listener count + stores server anchors.
        // Time is calculated client-side from startTimeUnix; only hard-correct on major drift (>2s).
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

            // Keep server anchors fresh for client-side calculation
            if (startTimeUnix !== undefined) playerStore.setStartTimeUnix(startTimeUnix);
            if (pausedAtMs !== undefined) playerStore.setPausedAtMs(pausedAtMs ?? null);
            playerStore.setPlaying(isPlaying);

            const { listenerLocalPaused } = usePlayerStore.getState();
            if (listenerLocalPaused) return;

            const expectedMs = computePositionFromSync(isPlaying, startTimeUnix, pausedAtMs, serverTimestamp);
            const liveTimeMs = audioRef.current ? audioRef.current.currentTime * 1000 : usePlayerStore.getState().currentTimeMs;
            const drift = Math.abs(liveTimeMs - expectedMs);

            // Only hard-correct on major drift (>2s) to avoid audible skipping
            if (drift > 2000) {
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
        }: {
            songIndex: number;
            song?: { _id: string; title: string; artist: string; duration: number; imageUrl?: string; s3Key: string; albumId?: string | null };
            songPresignedUrl?: string;
            startTimeUnix: number;
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

        // Creator lost connection — room stays alive, music keeps playing
        socket.on('room:creator_away', () => {
            roomStore.setCreatorAway(true);
            toast.info('Creator lost connection — music continues', { duration: 4000 });
        });

        socket.on('room:creator_reconnected', () => {
            roomStore.setCreatorAway(false);
            roomStore.setCreatorDisconnectCountdown(null);
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        });

        // Creator is manually ending the stream — give listeners a countdown
        socket.on('room:ending_soon', ({ seconds }: { seconds: number }) => {
            let remaining = seconds;
            toast.warning(`Stream ending in ${remaining}s…`, { id: 'ending-soon', duration: seconds * 1000 });
            const tick = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) { clearInterval(tick); return; }
                toast.warning(`Stream ending in ${remaining}s…`, { id: 'ending-soon', duration: remaining * 1000 });
            }, 1000);
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

        socket.on('room:goal_updated', ({ streamGoal, streamGoalCurrent, donor }: {
            roomId: string;
            streamGoal: number;
            streamGoalCurrent: number;
            donor: { name: string; amount: number } | null;
        }) => {
            const current = roomStore.room;
            if (current) roomStore.setRoom({ ...current, streamGoal, streamGoalCurrent });
            // Floating donor notification
            if (donor?.name) {
                toast(`🪙 ${donor.name} donated ${donor.amount.toLocaleString()} coins!`, {
                    duration: 5000,
                    style: { background: '#18181b', border: '1px solid #a78bfa', color: '#fff' },
                });
            }
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

        // ── Minigames (listeners + creator) ──────────────────────────────────
        socket.on('room:game_start', (game: ActiveGame & { roomId?: string }) => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return; // creator handles this in CreatorLivePage directly
            roomStore.setActiveGame(game);
            const secs = Math.ceil((new Date(game.endsAt).getTime() - Date.now()) / 1000);
            roomStore.setGameSecondsLeft(Math.max(0, secs));
            // Countdown ticker for listener UI
            const tick = setInterval(() => {
                const cur = useRoomStore.getState().gameSecondsLeft;
                if (cur <= 1) { clearInterval(tick); roomStore.setGameSecondsLeft(0); }
                else roomStore.setGameSecondsLeft(cur - 1);
            }, 1000);
        });

        socket.on('room:game_result', ({ winner }: { winner: { username: string; answer: string } | null; participantCount: number }) => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return; // creator handles this in CreatorLivePage
            roomStore.setActiveGame(null);
            roomStore.setGameSecondsLeft(0);
            if (winner) toast.success(`🏆 ${winner.username} won with "${winner.answer}"!`);
            else        toast.info('Game ended — no winner this round');
        });

        socket.on('room:game_progress', ({ participantCount }: { participantCount: number }) => {
            void participantCount;
        });

        // ── Voting & Reactions ───────────────────────────────────────────
        socket.on('room:skip_vote_update', ({ voteCount, needed }: { voteCount: number; needed: number }) => {
            roomStore.setSkipVotes({ count: voteCount, needed });
        });

        socket.on('room:reaction_update', ({ likes, dislikes }: { likes: number; dislikes: number }) => {
            roomStore.setReactions({ likes, dislikes });
        });

        socket.on('room:emoji_burst', ({ userId: uid, userName, emoji }: { userId: string; userName: string; emoji: string }) => {
            roomStore.addEmojiBurst({ id: `${Date.now()}-${uid}`, userId: uid, userName, emoji });
        });

        socket.on('room:nominations_update', ({ nominations }: { nominations: Nomination[] }) => {
            roomStore.setNominations(nominations);
        });

        socket.on('room:message_pinned', (msg: { id: string; userId: string; userName: string; message: string; pinnedAt: string }) => {
            roomStore.setPinnedMessage(msg);
        });

        socket.on('room:queue_song_added', ({ title }: { title?: string }) => {
            toast.success(`"${title ?? 'Song'}" was voted into the queue!`);
        });

        // Reset per-song state when song changes
        socket.on('room:song_changed', () => {
            roomStore.setSkipVotes({ count: 0, needed: useRoomStore.getState().skipVotes.needed });
            roomStore.setReactions({ likes: 0, dislikes: 0 });
        });

        // ── Session Timer ────────────────────────────────────────────────
        socket.on('room:session_warning', ({ remainingMinutes, message }: { remainingMinutes: number; message: string }) => {
            toast.warning(message);
            void remainingMinutes;
        });

        socket.on('room:session_expired', ({ message }: { message: string }) => {
            toast.error(message);
        });

        // ── Creator mic audio relay (listeners only) ──────────────────────────
        socket.on('room:creator_speaking', () => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return; // creator is the sender
            roomStore.setCreatorAudioReceiving();
        });

        socket.on('room:audio_chunk', ({ chunk, mimeType }: { chunk: string; mimeType?: string }) => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return;
            roomStore.addCreatorAudioChunk(chunk, mimeType);
        });

        socket.on('room:creator_done', () => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return;
            roomStore.setCreatorAudioDone();
        });

        // ── Broadcast asset playback (pre-recorded / uploaded file) ──────────
        // Server already fetched a presigned GET URL — just play it directly.
        socket.on('room:asset_broadcast', ({
            label, url, durationSeconds,
        }: { assetId: string; label: string; url: string; durationSeconds: number | null }) => {
            const { isCreator } = useRoomStore.getState();
            if (isCreator) return; // creator knows what they triggered
            roomStore.setBroadcastAsset({ url, label, durationSeconds });
        });

        // ── Feature flag live updates ─────────────────────────────────────────
        socket.on('room:flags_updated', ({ featureFlags }: { featureFlags: Record<string, boolean> }) => {
            roomStore.updateFeatureFlags(featureFlags);
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
            playStateCallbackRef.current = null;
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.emit('room:leave', { roomId, clerkId: userId });
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, userId]);

    return { sendChat, skipSong, leaveRoom, donate, updateGoal, submitAnswer, voteSkip, reactToSong, sendEmoji, nominateSong, voteForSong, pinMessage };
};
