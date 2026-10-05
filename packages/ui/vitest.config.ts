import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Les tests de thème remplacent `document` et `localStorage` eux-mêmes ; ceux des composants ont besoin de jsdom.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
