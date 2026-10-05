import { defineConfig } from 'vite'

// Un seul fichier sans dépendance, `dist/pont.js`, que chaque fiche embarque.
export default defineConfig({
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
