/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Identifiant court du commit, injecté par la CI. */
  readonly VITE_COMMIT?: string
  /** `ancre` (GitHub Pages, par défaut) ou `chemins` (VPS). */
  readonly VITE_HISTORIQUE?: string
  /** `demo` (GitHub Pages, par défaut) ou `http`. */
  readonly VITE_TRANSPORT?: string
  /** Adresse de l'API en mode `http` (par défaut `/api`). */
  readonly VITE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
