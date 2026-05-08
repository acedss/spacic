// Ghost listeners — 4 socket.io clients impersonating seeded demo_listener_* users.
//
// Why this exists:
//   The recorded browser session shows ONE user (the dev account). To make the
//   live room feel populated on camera, we connect 4 background socket clients
//   that emit real chat messages, donations, reactions, and emoji bursts —
//   driving the same Socket.IO server the recording browser is connected to.
//
// How impersonation works (no Clerk needed):
//   backend/src/lib/socket.js:1297 reads `socket.handshake.auth.clerkId` and
//   resolves the user from MongoDB. There is no token verification on socket
//   handshake — so passing a seeded clerkId is enough to fully authenticate
//   the ghost as that user. This is acceptable because (a) DEV_TOKEN gate +
//   (b) only seeded `demo_*` users are used.
//
// Usage:
//   tsx src/ghost-listeners.ts --room "Midnight Standards" --duration 120
//
//   --room      <title>   Title of the live room to join (case-insensitive)
//   --duration  <seconds> How long ghosts stay before disconnecting (default 180)
//   --quiet               Skip chat (donations + reactions still fire)

import 'dotenv/config';
import { io, Socket } from 'socket.io-client';
import { resolveRoomIdByTitle } from './lib/resolveRoom.js';
import { GHOST_SCRIPTS, DEFAULT_SCRIPT, type GhostScript } from './lib/ghostScript.js';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const DEV_TOKEN   = process.env.DEV_TOKEN   ?? 'spacic-dev-2026';

const GHOSTS = [
    process.env.GHOST_CLERK_ID_1 ?? 'demo_listener_lila',
    process.env.GHOST_CLERK_ID_2 ?? 'demo_listener_aki',
    process.env.GHOST_CLERK_ID_3 ?? 'demo_listener_juno',
    process.env.GHOST_CLERK_ID_4 ?? 'demo_listener_ren',
];

// ── CLI ──────────────────────────────────────────────────────────────────────

const parseArgs = () => {
    const argv = process.argv.slice(2);
    const get  = (name: string) => {
        const i = argv.indexOf(`--${name}`);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    return {
        roomTitle: get('room')     ?? 'Midnight Standards',
        duration:  parseInt(get('duration') ?? '180', 10),
        roomId:    get('roomId'),  // optional pre-resolved id (used by the spec)
        quiet:     argv.includes('--quiet'),
    };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const jitter = (baseMs: number, spreadMs: number) =>
    baseMs + Math.floor(Math.random() * spreadMs);

// Spread out actions so they don't fire on the same tick — the recording reads
// more naturally when chats trickle in instead of bursting.
const stagger = (idx: number) => sleep(idx * 1500 + Math.random() * 800);

// ── Single ghost ─────────────────────────────────────────────────────────────

interface GhostHandle {
    clerkId: string;
    socket:  Socket;
    stop:    () => void;
}

const startGhost = async (
    clerkId: string,
    roomId:  string,
    quiet:   boolean,
): Promise<GhostHandle> => {
    const script: GhostScript = GHOST_SCRIPTS[clerkId] ?? DEFAULT_SCRIPT;

    const socket = io(BACKEND_URL, {
        transports:    ['websocket'],
        auth:          { clerkId },
        reconnection:  true,
        timeout:       8000,
    });

    const tag = (msg: string) => `[ghost ${clerkId}] ${msg}`;

    socket.on('connect',         () => console.log(tag(`connected ${socket.id}`)));
    socket.on('disconnect',      (r) => console.log(tag(`disconnected (${r})`)));
    socket.on('connect_error',   (e) => console.error(tag(`connect_error: ${e.message}`)));
    socket.on('room:error',      (e: { message: string }) => console.error(tag(`room:error ${e.message}`)));
    socket.on('room:joined',     (p: { roomId: string }) => console.log(tag(`joined room ${p.roomId}`)));

    // Wait until connected before emitting room:join. socket.io's connect cb
    // races with subsequent emits otherwise.
    await new Promise<void>((resolve) => {
        if (socket.connected) return resolve();
        socket.once('connect', () => resolve());
    });

    socket.emit('room:join', { roomId, clerkId });

    // ── Action loops ─────────────────────────────────────────────────────────
    let stopped = false;

    const chatLoop = async () => {
        if (quiet) return;
        let i = 0;
        while (!stopped && i < script.chat.length) {
            await sleep(jitter(8000, 4000)); // 8–12s between messages
            if (stopped) break;
            socket.emit('room:chat', { roomId, message: script.chat[i] });
            i += 1;
        }
    };

    const donateLoop = async () => {
        let i = 0;
        while (!stopped && i < script.donateCoins.length) {
            await sleep(jitter(20_000, 15_000)); // 20–35s between donations
            if (stopped) break;
            const amount = script.donateCoins[i];
            socket.emit('room:donate', {
                roomId,
                amount,
                idempotencyKey: `${clerkId}-${Date.now()}-${i}`,
            });
            i += 1;
        }
    };

    const reactionLoop = async () => {
        let i = 0;
        while (!stopped && i < script.reactions.length) {
            await sleep(jitter(15_000, 5_000));
            if (stopped) break;
            socket.emit('room:song_reaction', { roomId, reaction: script.reactions[i] });
            i += 1;
        }
    };

    const emojiLoop = async () => {
        // Emoji bursts are the most visual — fire a small flurry every 10–15s
        while (!stopped) {
            await sleep(jitter(10_000, 5_000));
            if (stopped) break;
            const emoji = script.emoji[Math.floor(Math.random() * script.emoji.length)];
            socket.emit('room:emoji', { roomId, emoji });
        }
    };

    // Fire-and-forget — kept alive by the outer duration timer
    chatLoop();
    donateLoop();
    reactionLoop();
    emojiLoop();

    return {
        clerkId,
        socket,
        stop: () => {
            stopped = true;
            socket.emit('room:leave', { roomId, clerkId });
            // Give the leave a tick to flush before disconnecting
            setTimeout(() => socket.disconnect(), 250);
        },
    };
};

// ── Orchestration ────────────────────────────────────────────────────────────

const main = async () => {
    const { roomTitle, duration, roomId: passedRoomId, quiet } = parseArgs();

    const roomId = passedRoomId
        ?? await resolveRoomIdByTitle(BACKEND_URL, roomTitle, DEV_TOKEN);

    console.log(`[ghosts] target room ${roomId} (${roomTitle}) for ${duration}s`);

    const handles: GhostHandle[] = [];
    for (let i = 0; i < GHOSTS.length; i += 1) {
        await stagger(i); // spread joins over ~6s — looks organic on camera
        try {
            const h = await startGhost(GHOSTS[i], roomId, quiet);
            handles.push(h);
        } catch (e) {
            console.error(`[ghosts] failed to start ${GHOSTS[i]}: ${(e as Error).message}`);
        }
    }

    // Run for the requested duration, then tear down
    await sleep(duration * 1000);
    console.log('[ghosts] duration elapsed — disconnecting');
    handles.forEach(h => h.stop());

    // Allow leave events to drain
    await sleep(1000);
    process.exit(0);
};

process.on('SIGINT',  () => { console.log('\n[ghosts] SIGINT — exiting'); process.exit(0); });
process.on('SIGTERM', () => { console.log('[ghosts] SIGTERM — exiting'); process.exit(0); });

main().catch((err) => {
    console.error('[ghosts] fatal:', err);
    process.exit(1);
});
