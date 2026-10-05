/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Identifiant court du commit, injecté par la CI. */
  readonly VITE_COMMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
