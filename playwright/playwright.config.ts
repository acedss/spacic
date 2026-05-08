import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const VIEWPORT = { width: 1920, height: 1080 };

export default defineConfig({
    testDir: './tests',
    timeout: 15 * 60 * 1000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: './recordings/raw',

    use: {
        baseURL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
        viewport: VIEWPORT,
        // Stamp every browser HTTP call with the dev-token bypass so the recording
        // never has to run Clerk sign-in on camera. This applies to fetch + XHR.
        extraHTTPHeaders: {
            'x-dev-token': process.env.DEV_TOKEN ?? 'spacic-dev-2026',
        },
        video:        { mode: 'on', size: VIEWPORT },
        screenshot:   'only-on-failure',
        trace:        'off',
        actionTimeout:     8_000,
        navigationTimeout: 30_000,
        // 80ms feels intentional without dragging. 250ms compounds into visible jank.
        launchOptions: { slowMo: 80 },
    },

    projects: [
        {
            name: 'chromium-1080p',
            use: { ...devices['Desktop Chrome'], viewport: VIEWPORT },
        },
    ],
});
