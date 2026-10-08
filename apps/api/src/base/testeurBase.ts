import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { creerAcces } from './acces.ts'
import { migrer } from './migrer.ts'

// Aide des tests d'intégration : une base neuve, migrée, par fichier de test.

/** Le serveur PostgreSQL des tests (service de la CI) ; `undefined` hors CI sans base locale. */
export const URL_SERVEUR_TEST = process.env['DATABASE_URL']

function urlDeLaBase(urlServeur: string, nom: string): string {
  const url = new URL(urlServeur)
  url.pathname = `/${nom}`
  return url.toString()
}

/** Crée une base vide, y applique les migrations, la rend avec de quoi la supprimer. */
export async function creerBaseDeTest(urlServeur: string) {
  const nom = `janus_test_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Client({ connectionString: urlServeur })
  await admin.connect()
  await admin.query(`CREATE DATABASE "${nom}"`)
  const url = urlDeLaBase(urlServeur, nom)
  await migrer(url)
  // La base est supprimée de force à la fin : une connexion qui se ferme à ce moment n'est pas une erreur.
  const acces = creerAcces(url, () => undefined)
  return {
    url,
    ...acces,
    /** Ferme la connexion et supprime la base. */
    async supprimer(): Promise<void> {
      await acces.pool.end()
      await admin.query(`DROP DATABASE "${nom}" WITH (FORCE)`)
      await admin.end()
    },
  }
}
