/**
 * Spacic — automatic screenshot capture
 *
 * Usage from project root:
 *   cd playwright
 *   HEADFUL=1 npx tsx src/capture-screenshots.ts   # first time → sign in by hand
 *   npx tsx src/capture-screenshots.ts             # subsequent runs → fully unattended
 *
 * Output: ../screenshots/01-home.png … 13-room-live.png
 */
import { chromium, devices } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SPACIC_URL ?? 'https://spacic.aceds.space';
const OUT  = path.resolve(__dirname, '..', '..', 'screenshots');
const VIEWPORT = { width: 1440, height: 900 } as const;
const STATE_FILE = path.resolve(__dirname, '..', 'storage', 'spacic.json');
const HEADFUL = process.env.HEADFUL === '1' || process.env.HEADFUL === 'true';

const SHOTS = [
  { id: '01-home',         path: '/',                                          label: 'Home — hero · live now · friends' },
  { id: '02-discover',     path: '/discover',                                  label: 'Discover — tags · rooms grid' },
  { id: '03-rooms',        path: '/rooms',                                     label: 'Public rooms list' },
  { id: '04-search',       path: '/search?q=lofi',                             label: 'Search — query=lofi' },
  { id: '05-friends',      path: '/friends',                                   label: 'Friends + activity feed' },
  { id: '06-favorites',    path: '/favorites',                                 label: 'Favorites' },
  { id: '07-wallet',       path: '/wallet',                                    label: 'Wallet — balance + topup packages' },
  { id: '08-subscription', path: '/subscription',                              label: 'Subscription tiers' },
  { id: '09-studio',       path: '/studio',                                    label: 'Creator studio' },
  { id: '10-profile',      path: '/profile',                                   label: 'Public profile' },
  { id: '11-onboarding',   path: '/onboarding',                                label: 'Onboarding wizard' },
  { id: '12-admin',        path: '/admin',                                     label: 'Admin dashboard (admin role required)' },
];

async function ensure(p: string) { await fs.promises.mkdir(p, { recursive: true }); }

async function pause(msg: string) {
  if (!process.stdin.isTTY) return;
  process.stdout.write(`\n[capture] ${msg}\n[capture] press <enter> when done… `);
  await new Promise<void>((r) => process.stdin.once('data', () => r()));
}

(async () => {
  await ensure(OUT);
  await ensure(path.dirname(STATE_FILE));

  const hasState = fs.existsSync(STATE_FILE);
  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState: hasState ? STATE_FILE : undefined,
    userAgent: devices['Desktop Chrome'].userAgent,
  });
  const page = await ctx.newPage();

  if (!hasState) {
    if (!HEADFUL) {
      console.log('[capture] no saved auth state. run again with HEADFUL=1 first.');
      console.log('  HEADFUL=1 npx tsx src/capture-screenshots.ts');
      await browser.close();
      process.exit(1);
    }
    await page.goto(BASE + '/');
    await pause('Sign into Spacic in the opened browser, then return here.');
    await ctx.storageState({ path: STATE_FILE });
    console.log('[capture] saved auth state to', STATE_FILE);
  }

  for (const s of SHOTS) {
    const url = BASE + s.path;
    process.stdout.write(`[capture] ${s.id} · ${url} … `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25_000 });
    } catch {
      console.log('(navigation timeout — snapping anyway)');
    }
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `${s.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log('OK  ->', path.relative(process.cwd(), file));
  }

  // Bonus: enter the first live room and snap chat panel
  process.stdout.write('[capture] looking for a live room … ');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {});
  const link = page.locator('a[href^="/rooms/"]').first();
  if (await link.count()) {
    const href = await link.getAttribute('href');
    console.log('joining', href);
    await page.goto(BASE + href!, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, '13-room-live.png') });
    console.log('[capture] 13-room-live OK');
  } else {
    console.log('no live room visible — skipping');
  }

  console.log(`\n[capture] done — see ${OUT}`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
