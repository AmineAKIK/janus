import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { NOM_APPLI } from '../../packages/ui/src/nomAppli.ts'
import { avecPrechargement } from './src/api/prechargement.ts'

// Fond de la tuile des icônes : le fond du thème sombre de `packages/ui/src/tokens.css`.
const FOND_MARQUE = '#14171a'

// Les adresses des raccourcis suivent le mode d'historique : `revision` en vraies adresses, `#/revision` en ancres.
const ANCRES = process.env['VITE_HISTORIQUE'] !== 'chemins'
const raccourci = (chemin: string) => (ANCRES ? `./#/${chemin}` : `./${chemin}`)

// Un build qui parle à l'API (le VPS) lance les premières lectures avec la page, avant le JavaScript.
function prechargementApi(): Plugin {
  const base = process.env['VITE_BASE'] ?? '/janus/'
  return {
    name: 'janus-prechargement-api',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        process.env['VITE_TRANSPORT'] === 'http'
          ? avecPrechargement(html, process.env['VITE_API'] ?? '/api', base)
          : html,
    },
  }
}

// `VITE_BASE` vaut `/janus/` en production et `/janus/pr-preview/pr-<numéro>/` pour un aperçu de PR.
export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/janus/',
  plugins: [
    react(),
    prechargementApi(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Pas d'activation silencieuse : l'appli propose la mise à jour (`MiseAJour.tsx`).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        // L'identité de l'appli installée : la même quelle que soit l'adresse de lancement.
        id: process.env['VITE_BASE'] ?? '/janus/',
        name: NOM_APPLI,
        short_name: NOM_APPLI,
        start_url: './',
        scope: './',
        display: 'standalone',
        // Repli sur la fenêtre minimale si le système ne sait pas faire sans barre d'adresse.
        display_override: ['standalone', 'minimal-ui'],
        categories: ['education', 'productivity'],
        theme_color: FOND_MARQUE,
        background_color: FOND_MARQUE,
        description: 'Chaque boucle te fait monter.',
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
          // Android 13 et plus : l'icône thématique prend la couleur du fond d'écran de l'utilisateur.
          {
            src: 'icones/icone-monochrome.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'monochrome',
          },
        ],
        shortcuts: [
          {
            name: 'Aujourd’hui',
            url: raccourci(''),
            icons: [{ src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Révision',
            url: raccourci('revision'),
            icons: [{ src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Journal',
            url: raccourci('journal'),
            icons: [{ src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        // Les captures de la boîte d'installation (Chrome, Edge) : mobile en sombre, bureau en clair.
        screenshots: [
          {
            src: 'installation/aujourdhui-mobile.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Aujourd’hui : la prochaine étape de la séance',
          },
          {
            src: 'installation/suivi-mobile.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Suivi : la carte du module',
          },
          {
            src: 'installation/aujourdhui-bureau.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Aujourd’hui : la prochaine étape de la séance',
          },
          {
            src: 'installation/suivi-bureau.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Suivi : la carte du module',
          },
        ],
      },
      injectManifest: {
        // Les fiches ne sont pas précachées : le service worker les garde à la première ouverture.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Ni la page d'accueil publique, ni les images de partage et d'installation : l'appli n'en a pas besoin hors ligne.
        globIgnores: [
          'fiches/**',
          'vitrine.html',
          'assets/vitrine-*',
          'og-image.png',
          'installation/**',
        ],
      },
    }),
  ],
  // Les parcours contre l'API réelle (`playwright.api.config.ts`) passent par ce proxy : même origine que l'appli.
  preview: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  build: {
    rollupOptions: {
      input: { index: 'index.html', vitrine: 'vitrine.html' },
    },
  },
})
