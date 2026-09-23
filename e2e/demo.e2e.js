// Smoke tests E2E du mode démo : l'app tourne sans Firebase (stubs en mémoire),
// ce qui rend ces parcours déterministes et 100 % hors réseau applicatif.
import { test, expect } from '@playwright/test';

const DEMO_URL = './#demo';
const BACKEND_HOSTS = /firebase|gstatic\.com|googleapis\.com/;

/**
 * Coupe les appels tiers non essentiels (tuiles OSM, météo) : rendu stable,
 * aucun trafic réseau réel pendant les tests.
 * @param {import('@playwright/test').Page} page
 */
async function stubThirdParties(page){
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/api\.open-meteo\.com/, (route) => route.abort());
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function openJournal(page){
  await page.locator('.tab[data-page="journal"]').click();
  await expect(page.locator('#journalList .journal-entry').first()).toBeVisible();
}

test.describe('demo mode (service worker bloqué, réseau intercepté)', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await stubThirdParties(page);
  });

  test('boots with the demo banner and the map, without any backend request', async ({ page }) => {
    const backendRequests = [];
    page.on('request', (req) => {
      if (BACKEND_HOSTS.test(new URL(req.url()).hostname)) backendRequests.push(req.url());
    });

    await page.goto(DEMO_URL);

    await expect(page.locator('#demoBanner')).toBeVisible();
    await expect(page.locator('#visitorGate')).not.toHaveClass(/\bvis\b/);
    await expect(page.locator('#map.leaflet-container')).toBeVisible();
    await openJournal(page);
    await expect(page.locator('#journalList .journal-entry')).not.toHaveCount(0);

    expect(backendRequests).toEqual([]);
  });

  test('lets a visitor post a comment', async ({ page }) => {
    await page.goto(DEMO_URL);
    await openJournal(page);

    const entry = page.locator('#journalList .journal-entry').first();
    const text = 'Superbe étape, bravo ! ' + Date.now();
    await entry.locator('textarea[id^="ctxt-"]').fill(text);
    await entry.locator('.comment-send').click();

    await expect(entry.locator('.comment-card .comment-text', { hasText: text })).toBeVisible();
    await expect(entry.locator('textarea[id^="ctxt-"]')).toHaveValue('');
  });

  test('demo admin can publish and unpublish a journal day', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator('#demoAdminBtn').click();

    await expect(page.locator('#tabStages')).toBeVisible();
    await expect(page.locator('#tabDepenses')).toBeVisible();

    await openJournal(page);
    const entry = page.locator('#journalList .journal-entry').first();
    const badge = entry.locator('.j-pub-badge');
    await expect(badge).toHaveText(/Publié/);

    await entry.locator('.j-pub-btn').click();
    await expect(badge).toHaveText('Brouillon');
    await entry.locator('.j-pub-btn').click();
    await expect(badge).toHaveText(/Publié/);
  });

  test('demo admin sees the activity dashboard', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator('#demoAdminBtn').click();
    await page.locator('#tabActivity').click();

    const cards = page.locator('#activitySummary .activity-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.first().locator('.activity-num')).not.toHaveText('0');
    await expect(page.locator('#activityTimeline .activity-bar-item')).toHaveCount(7);
    await expect(page.locator('#activityList .activity-event').first()).toBeVisible();
  });

  test('demo admin sees the health and training charts', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.locator('#demoAdminBtn').click();

    await page.locator('#tabHealth').click();
    await expect(page.locator('#healthGraphs svg path')).toHaveCount(9);
    await expect(page.locator('#healthGraphs svg path').first()).toHaveAttribute('d', /^M \d+ \d+ L /);

    await page.locator('#tabTraining').click();
    await expect(page.locator('#trainingWeek .training-card')).toHaveCount(4);
    await expect(page.locator('#trainingGraphs svg path').first()).toHaveAttribute('d', /^M \d+ \d+ L /);
  });

  test('archive mode hides every visitor write control', async ({ page }) => {
    await page.goto(DEMO_URL);
    await openJournal(page);
    await expect(page.locator('.comment-send').first()).toBeVisible();

    // La vraie version est archivée (ARCHIVED = !DEMO_MODE) ; on bascule le
    // flag en démo pour vérifier le rendu lecture seule sans backend.
    await page.evaluate(() => {
      window.ARCHIVED = true;
      window.renderJournal();
    });

    await expect(page.locator('.archive-note')).toBeVisible();
    await expect(page.locator('.comment-send')).toHaveCount(0);
    await expect(page.locator('.j-bravo-btn')).toHaveCount(0);
    await expect(page.locator('textarea[id^="ctxt-"]')).toHaveCount(0);
  });
});

test.describe('PWA', () => {
  test('service worker installs under the GitHub Pages sub-path and serves the demo offline', async ({ page, context }) => {
    await page.goto(DEMO_URL);
    await expect(page.locator('#demoBanner')).toBeVisible();

    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { state: reg.active && reg.active.state, scope: reg.scope };
    });
    expect(swState.state).toBe('activated');
    expect(new URL(swState.scope).pathname).toBe('/France-Irlande/');

    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('#demoBanner')).toBeVisible();
    await expect(page.locator('#map.leaflet-container')).toBeVisible();
    await openJournal(page);
  });
});
