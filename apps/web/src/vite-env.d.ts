/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Identifiant court du commit, injecté par la CI. */
  readonly VITE_COMMIT?: string
  /** `ancre` (GitHub Pages, par défaut) ou `chemins` (VPS). */
  readonly VITE_HISTORIQUE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
