import { defineConfig } from 'drizzle-kit'

// `pnpm --filter @janus/api migrations:generer` écrit le SQL des migrations ; il ne touche à aucune base.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/base/schema/index.ts',
  out: './migrations',
})
