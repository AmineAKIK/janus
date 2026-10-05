import { defineConfig, devices } from '@playwright/test'

const base = process.env['PLAYWRIGHT_BASE_PATH'] ?? '/janus/'

export default defineConfig({
  testDir: './e2e',
  outputDir: './captures/traces',
  forbidOnly: process.env['CI'] !== undefined,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',
  use: { baseURL: `http://localhost:4173${base}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview',
    url: `http://localhost:4173${base}`,
    reuseExistingServer: process.env['CI'] === undefined,
  },
})
