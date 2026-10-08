import pg from 'pg'

/** Ce que l'API demande à PostgreSQL pour l'instant ; les transactions arrivent avec le schéma. */
export interface Base {
  readonly requete: (texte: string) => Promise<unknown>
  readonly fermer: () => Promise<void>
}

export function creerBase(urlConnexion: string): Base {
  const pool = new pg.Pool({ connectionString: urlConnexion })
  return {
    requete: (texte) => pool.query(texte),
    fermer: () => pool.end(),
  }
}
