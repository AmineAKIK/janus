import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // Seuil bloquant : toute règle du moteur est testée, ligne par ligne et branche par branche.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
})
