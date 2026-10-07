import { defineConfig, devices } from '@playwright/test'

const base = process.env['PLAYWRIGHT_BASE_PATH'] ?? '/janus/'

export default defineConfig({
  testDir: './e2e',
  outputDir: './captures/traces',
  forbidOnly: process.env['CI'] !== undefined,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',
  // Le service worker est bloqué par défaut : seule `horsLigne.spec.ts` le laisse agir.
  use: { baseURL: `http://localhost:4173${base}`, serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview',
    url: `http://localhost:4173${base}`,
    reuseExistingServer: process.env['CI'] === undefined,
  },
})
