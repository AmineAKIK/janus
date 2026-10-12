import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Les écrans se rendent en entier ; sous couverture ou charge, 5 s ne laissent aucune marge.
    testTimeout: 15_000,
  },
})
