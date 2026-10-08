import { defineConfig, devices } from '@playwright/test'

// Les parcours critiques contre l'API réelle (PR-089) : l'appli est construite en `http` et sert
// `/api` par un proxy vers le banc de la CI (`pnpm --filter @janus/api banc`, port 3100). Un seul
// worker : tous les parcours partagent la base et l'horloge du banc.
export default defineConfig({
  testDir: './e2e-api',
  outputDir: './captures/traces-api',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',
  use: {
    baseURL: 'http://localhost:4173/',
    // Hors CI, un Chromium déjà installé peut remplacer celui que Playwright télécharge.
    ...(process.env['PLAYWRIGHT_CHROMIUM_PATH'] === undefined
      ? {}
      : { launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] } }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'vite build --outDir dist-api && vite preview --outDir dist-api --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    env: { VITE_BASE: '/', VITE_TRANSPORT: 'http', VITE_API: '/api' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
