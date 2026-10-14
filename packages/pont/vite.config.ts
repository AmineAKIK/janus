import { createHash } from 'node:crypto'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { VERSION_PONT } from './src/version.ts'

/**
 * La première ligne de `pont.js` : `/*! janus-pont v<version> <empreinte> *\/`, la version du contrat et
 * l'empreinte SHA-256 du code qui suit. Une fiche embarque le pont tel quel ; `pnpm fiches:verifier`
 * lit cet en-tête pour savoir si le pont embarqué est celui du dépôt, même reformaté par Prettier.
 */
function enTete(): Plugin {
  return {
    name: 'janus-en-tete',
    generateBundle(_options, bundle) {
      for (const sortie of Object.values(bundle)) {
        if (sortie.type !== 'chunk') continue
        const empreinte = createHash('sha256').update(sortie.code).digest('hex')
        sortie.code = `/*! janus-pont v${String(VERSION_PONT)} ${empreinte} */\n${sortie.code}`
      }
    },
  }
}

// Un seul fichier sans dépendance, `dist/pont.js`, que chaque fiche embarque.
export default defineConfig({
  plugins: [enTete()],
  build: {
    lib: {
      entry: 'src/entree.ts',
      formats: ['iife'],
      name: 'JanusPontModule',
      fileName: () => 'pont.js',
    },
    target: 'es2022',
    minify: true,
    emptyOutDir: true,
  },
})
