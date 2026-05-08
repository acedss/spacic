// Spacic 10-min demo recording — single continuous WebM at 1920x1080.
//
// Three lessons baked in from take 1:
//   1. NEVER waitForLoadState('networkidle') — Socket.IO heartbeats keep the
//      page from ever being "idle". Use 'domcontentloaded' + a short beat.
//   2. Slow-mo 250ms compounds into visible jank — 80ms in playwright.config
//      is enough for cinematic pacing.
//   3. Per-scene dwell needs to total ~8 min, not 2 min, for the source clip
//      to be useful as a backup video. Remotion will speed/cut later.

import { test, expect, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'node:child_process';
import { resolveRoomIdByTitle } from '../src/lib/resolveRoom.js';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const DEV_TOKEN   = process.env.DEV_TOKEN   ?? 'spacic-dev-2026';

const ROOM_TITLE_LIVE = 'Modern R&B Lounge'; // most songs → richest scene

// ── Setup helpers ────────────────────────────────────────────────────────────

const triggerRecSysTraining = async () => {
    try {
        const r = await fetch(`${BACKEND_URL}/api/admin/recsys/train`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'x-dev-token': DEV_TOKEN },
            body:    JSON.stringify({ force: true }),
        });
        console.log(`[setup] recsys train → ${r.status}`);
    } catch (e) {
        console.warn(`[setup] recsys train skipped: ${(e as Error).message}`);
    }
};

const spawnGhosts = (roomId: string, durationSec: number): ChildProcess => {
    const proc = spawn(
        'tsx',
        ['src/ghost-listeners.ts', '--roomId', roomId, '--duration', String(durationSec)],
        { cwd: process.cwd(), stdio: 'inherit', env: process.env },
    );
    proc.on('error', (e) => console.error(`[ghosts] spawn error: ${e.message}`));
    return proc;
};

const injectDevToken = async (page: Page) => {
    // Belt-and-braces: extraHTTPHeaders covers most requests, but some libs
    // (axios with custom interceptors) build Headers from scratch. Wrap fetch
    // and XHR open() so nothing slips through unauthenticated.
    await page.addInitScript((token: string) => {
        const origFetch = window.fetch;
        window.fetch = (input, init = {}) => {
            const headers = new Headers(init.headers ?? {});
            headers.set('x-dev-token', token);
            return origFetch(input, { ...init, headers });
        };
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args: unknown[]) {
            // @ts-expect-error variadic forwarding to native open
            origOpen.apply(this, args);
            this.setRequestHeader('x-dev-token', token);
        };
    }, DEV_TOKEN);
};

// Wait for the SPA shell, NOT for network silence. Socket.IO never goes idle.
const settle = async (page: Page, hold = 1500) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(hold);
};

const beat = (page: Page, ms = 1500) => page.waitForTimeout(ms);

// Slow scroll a list/grid so the recording shows the content properly.
const cinematicScroll = async (page: Page, totalMs = 4000, steps = 8) => {
    const stepDelay = totalMs / steps;
    for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(stepDelay);
    }
};

// ── The single recording test ───────────────────────────────────────────────

test('Spacic 10-min demo flow', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);

    await injectDevToken(page);
    await triggerRecSysTraining();

    let ghostProc: ChildProcess | undefined;

    try {
        // ── Scene 1: Home / Discover  (~60s) ─────────────────────────────────
        await page.goto('/');
        await settle(page, 4000);
        await cinematicScroll(page, 5000, 10);
        await beat(page, 2000);

        await page.goto('/discover');
        await settle(page, 4000);
        await cinematicScroll(page, 6000, 12);
        await beat(page, 3000);

        // ── Scene 2: Rooms — mood filter + grid  (~60s) ──────────────────────
        await page.goto('/rooms');
        await settle(page, 3000);
        await cinematicScroll(page, 4000, 8);

        // The Rooms page has the mood grid inline (no separate tab) — click
        // an R&B and a Soul card to demo the filter actually narrowing results.
        const rnbCard = page.getByText('R&B', { exact: true }).first();
        if (await rnbCard.isVisible().catch(() => false)) {
            await rnbCard.click();
            await beat(page, 4500);
            await cinematicScroll(page, 3000, 6);
            await rnbCard.click(); // toggle off
            await beat(page, 1500);
        }
        const soulCard = page.getByText('Soul', { exact: true }).first();
        if (await soulCard.isVisible().catch(() => false)) {
            await soulCard.click();
            await beat(page, 4000);
            await soulCard.click(); // toggle off
            await beat(page, 1500);
        }

        // Back to all rooms grid
        await page.goto('/rooms');
        await settle(page, 2000);
        await beat(page, 3000);

        // ── Scene 3: Live room with ghost listeners  (~210s = 3.5 min) ───────
        const roomId = await resolveRoomIdByTitle(BACKEND_URL, ROOM_TITLE_LIVE, DEV_TOKEN);
        // 220s of ghost activity gives the live scene a buffer either side
        ghostProc = spawnGhosts(roomId, 220);
        await beat(page, 4000); // let ghosts connect + start emitting first

        await page.goto(`/rooms/${roomId}`);
        await settle(page, 5000);

        // Open + close the room info modal — visual feature highlight
        const infoBtn = page.getByRole('button', { name: /info|about/i }).first();
        if (await infoBtn.isVisible().catch(() => false)) {
            await infoBtn.click();
            await beat(page, 3500);
            await page.keyboard.press('Escape');
            await beat(page, 1500);
        }

        // Recorded user sends a message too
        const chatInput = page.getByPlaceholder(/say something|message|chat/i).first();
        if (await chatInput.isVisible().catch(() => false)) {
            await chatInput.fill('this room is unreal tonight');
            await chatInput.press('Enter');
            await beat(page, 2500);

            await chatInput.fill('VinylVince knows how to set a vibe');
            await chatInput.press('Enter');
            await beat(page, 2500);
        }

        // Long dwell while ghosts produce chat/donations/reactions on screen
        await beat(page, 180_000); // 3 min of room footage

        // ── Scene 4: Studio overview  (~75s) ─────────────────────────────────
        // Studio tabs are styled <button>, not role="tab" — use exact text match.
        await page.goto('/studio');
        await settle(page, 4000);
        await cinematicScroll(page, 3000, 6);

        for (const label of ['Playlists', 'Broadcasts', 'Minigames', 'Settings']) {
            const tab = page.getByRole('button', { name: label, exact: true }).first();
            if (await tab.isVisible().catch(() => false)) {
                await tab.click();
                await beat(page, 4500);
                await cinematicScroll(page, 3000, 6);
            }
        }

        // ── Scene 5: Wallet + top-up  (~45s) ─────────────────────────────────
        await page.goto('/wallet');
        await settle(page, 4000);
        await cinematicScroll(page, 4000, 8);
        // Hover a top-up package to show the interactive state
        const topupCard = page.getByText(/top.?up|coins/i).first();
        if (await topupCard.isVisible().catch(() => false)) {
            await topupCard.hover();
            await beat(page, 3000);
        }
        await beat(page, 3000);

        // ── Scene 6: Subscription  (~40s) ────────────────────────────────────
        await page.goto('/subscription');
        await settle(page, 4000);
        await cinematicScroll(page, 4000, 8);
        await beat(page, 4000);

        // ── Scene 7: Friends  (~40s) ─────────────────────────────────────────
        await page.goto('/friends');
        await settle(page, 4000);
        await cinematicScroll(page, 4000, 8);
        await beat(page, 4000);

        // ── Scene 8: Admin panel — full tour  (~110s) ────────────────────────
        // Admin nav uses styled <button> with exact labels (NOT role="tab").
        // Catalog labels: 'Top-up Packages', 'RecSys', 'Platform Config' — case
        // matters for `name` exact-match.
        await page.goto('/admin');
        await settle(page, 4000);
        await cinematicScroll(page, 3000, 6);

        const adminLabels = [
            'Alerts', 'Plans', 'Top-up Packages', 'Users',
            'Songs', 'Catalog', 'Growth', 'RecSys', 'Platform Config',
        ];
        for (const label of adminLabels) {
            const tab = page.getByRole('button', { name: label, exact: true }).first();
            if (await tab.isVisible().catch(() => false)) {
                await tab.click();
                await beat(page, 4500);
                await cinematicScroll(page, 2500, 5);
            }
        }

        // ── Scene 9: Profile  (~30s) ─────────────────────────────────────────
        await page.goto('/profile');
        await settle(page, 4000);
        await cinematicScroll(page, 3000, 6);
        await beat(page, 4000);

        // Final hold — clean end frame for Remotion
        await beat(page, 3000);

        await expect(page.locator('body')).toBeVisible();
    } finally {
        if (ghostProc && !ghostProc.killed) ghostProc.kill('SIGTERM');
    }
});
