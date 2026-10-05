import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `VITE_BASE` vaut `/janus/` en production et `/janus/pr-preview/pr-<numéro>/` pour un aperçu de PR.
export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/janus/',
  plugins: [react()],
})
