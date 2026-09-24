// Tests E2E Playwright — smoke tests du mode démo (aucun backend Firebase).
// Fichiers *.e2e.js : volontairement hors du motif par défaut de Vitest.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/France-Irlande/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://localhost:${PORT}/France-Irlande/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
