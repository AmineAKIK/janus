import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Le test du build charge pont.js comme le ferait une fiche.
    environmentOptions: { jsdom: { runScripts: 'dangerously' } },
  },
})
