// Audit d'accessibilité automatisé (axe-core, WCAG 2 A/AA) sur les vues du
// mode démo, plus les parcours clavier ajoutés pour les éléments non-<button>.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/api\.open-meteo\.com/, (route) => route.abort());
  await page.goto('./#demo');
  await expect(page.locator('#demoBanner')).toBeVisible();
});

/**
 * Lance axe sur la page et échoue en listant les violations WCAG 2 A/AA.
 * @param {import('@playwright/test').Page} page
 * @param {string} view
 */
async function expectNoViolations(page, view){
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = violations.map((v) =>
    `${view} · ${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary).toEqual([]);
}

async function openJournal(page){
  await page.locator('.tab[data-page="journal"]').click();
  await expect(page.locator('#journalList .journal-entry').first()).toBeVisible();
  // Laisser le chargement paresseux (médias, commentaires) de la 1re entrée se terminer.
  await expect(page.locator('#journalList .journal-entry').first().locator('.j-skeleton')).toHaveCount(0);
}

async function enterDemoAdmin(page){
  await page.locator('#demoAdminBtn').click();
  await expect(page.locator('#tabStages')).toBeVisible();
}

test('visitor views have no WCAG A/AA violations', async ({ page }) => {
  // Attendre les tracés GPX et leurs marqueurs de fin d'étape (chargés en asynchrone).
  await expect(page.locator('.marker-stage-end').first()).toBeAttached();
  await expectNoViolations(page, 'carte');
  await openJournal(page);
  await expectNoViolations(page, 'carnet');
  await page.locator('#adminBtn').click();
  await expect(page.locator('#pwModal')).toHaveClass(/\bvis\b/);
  await expectNoViolations(page, 'connexion admin');
});

test('archive visitor gate has no WCAG A/AA violations', async ({ page }) => {
  await page.evaluate(() => {
    window.ARCHIVED = true;
    window.showVisitorGate();
  });
  await expect(page.locator('#visitorGate')).toHaveClass(/\bvis\b/);
  await expectNoViolations(page, 'gate visiteur (archive)');
});

test('admin views have no WCAG A/AA violations', async ({ page }) => {
  await enterDemoAdmin(page);
  for (const tab of ['stages', 'journal', 'depenses', 'info', 'activity']) {
    await page.locator(`.tab[data-page="${tab}"]`).click();
    await expect(page.locator(`#page-${tab}`)).toHaveClass(/\bactive\b/);
    if (tab === 'journal') {
      await expect(page.locator('#journalList .journal-entry').first().locator('.j-skeleton')).toHaveCount(0);
    }
    await expectNoViolations(page, `admin ${tab}`);
  }
  await page.locator('#adminBtn').click();
  await page.locator('[data-action="openProfileModal"]').click();
  await expect(page.locator('#profileModal')).toHaveClass(/\bvis\b/);
  await expectNoViolations(page, 'profil admin');
});

test('a journal photo opens from the keyboard and Escape closes the viewer', async ({ page }) => {
  await openJournal(page);
  const photo = page.locator('#journalList .j-photo-wrap img').first();
  await expect(photo).toHaveAttribute('alt', /^Photo du /);

  await photo.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lightbox')).toHaveClass(/\bvis\b/);
  await expect(page.locator('#lightboxImg')).toHaveAttribute('alt', /^Photo du /);
  await expectNoViolations(page, 'visionneuse');

  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).not.toHaveClass(/\bvis\b/);
});

test('Escape closes the admin login dialog', async ({ page }) => {
  await page.locator('#adminBtn').click();
  const dialog = page.getByRole('dialog', { name: 'Connexion admin' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
