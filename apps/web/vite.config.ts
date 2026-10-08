import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { NOM_APPLI } from '../../packages/ui/src/nomAppli.ts'

// `couleur/fond` clair, de `packages/ui/src/tokens.css`.
const FOND_CLAIR = '#f7f4ee'

// `VITE_BASE` vaut `/janus/` en production et `/janus/pr-preview/pr-<numéro>/` pour un aperçu de PR.
export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/janus/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Pas d'activation silencieuse : l'appli propose la mise à jour (`MiseAJour.tsx`).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: NOM_APPLI,
        short_name: NOM_APPLI,
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: FOND_CLAIR,
        background_color: FOND_CLAIR,
        lang: 'fr',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icones/icone-512-masquable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Les fiches ne sont pas précachées : le service worker les garde à la première ouverture.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['fiches/**', 'vitrine.html'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: { index: 'index.html', vitrine: 'vitrine.html' },
    },
  },
})
