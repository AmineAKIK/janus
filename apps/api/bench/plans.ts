// Les plans d'exécution de toutes les requêtes que chaque route émet, sur la base de mesure.
//
//   node apps/api/bench/plans.ts --base janus_perf_api [--sortie plans.txt]
//
// Le serveur tourne dans ce processus (`app.inject`) ; le journal de Drizzle donne chaque requête et ses
// paramètres, rejoués ensuite sous `EXPLAIN (ANALYZE, BUFFERS)` (les écritures dans une transaction annulée).
import { writeFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { baseDepuisPool } from '../src/base/base.ts'
import * as schema from '../src/base/schema/index.ts'
import { lireConfig } from '../src/config.ts'
import { horlogeSysteme } from '../src/horloge.ts'
import { creerServeur } from '../src/serveur.ts'
import { contexteDeMesure, scenarios } from './scenarios.ts'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}
const NOM_BASE = option('base', 'janus_perf_api')
const SORTIE = option('sortie', '')
const SANS = option('sans', '')
  .split(',')
  .filter((nom) => nom !== '')
const urlApp = `postgres://janus_perf_app:perf@localhost:5432/${NOM_BASE}`
const urlProprietaire = `postgres://janus:janus@localhost:5432/${NOM_BASE}`

interface Capture {
  route: string
  sql: string
  params: unknown[]
  ms: number
}
const captures: Capture[] = []
let routeCourante = ''

const pool = new pg.Pool({ connectionString: urlApp })
const db = drizzle(pool, {
  schema,
  logger: {
    logQuery: (sql, params) => {
      captures.push({ route: routeCourante, sql, params, ms: 0 })
    },
  },
})
const base = baseDepuisPool(db, pool)
const config = lireConfig({
  DATABASE_URL: urlApp,
  DATABASE_URL_PROPRIETAIRE: urlProprietaire,
  ORIGINE_APPLI: 'https://appli.test',
  FICHES_URL: 'https://fiches.test',
  COOKIE_SECURE: 'false',
  VAPID_PUBLIC_KEY: 'x',
  VAPID_PRIVATE_KEY: 'x',
  VAPID_SUJET: 'mailto:perf@example.test',
  NIVEAU_JOURNAL: 'silent',
  CONNEXIONS_PAR_ADRESSE_PAR_MINUTE: '1000',
})
const app = await creerServeur({ config, horloge: horlogeSysteme, base, proprietaire: base })
const connexion = await app.inject({
  method: 'POST',
  url: '/api/session',
  headers: { origin: 'https://appli.test' },
  payload: { nom_utilisateur: 'perf', mot_de_passe: 'perf-janus' },
})
const cookie = connexion.cookies[0]
if (cookie === undefined) throw new Error(`Connexion refusée : ${connexion.body}`)
const entetes = { origin: 'https://appli.test', cookie: `${cookie.name}=${cookie.value}` }
const lire = async (chemin: string): Promise<unknown> =>
  (await app.inject({ method: 'GET', url: chemin, headers: entetes })).json<unknown>()
const contexte = await contexteDeMesure(urlProprietaire, lire)

for (const scenario of scenarios(contexte)) {
  if (SANS.some((nom) => scenario.nom.includes(nom))) continue
  routeCourante = `${scenario.methode} ${scenario.nom}`
  const debut = performance.now()
  const reponse = await app.inject({
    method: scenario.methode,
    url: scenario.chemin(),
    headers: entetes,
    ...(scenario.corps === undefined ? {} : { payload: scenario.corps() }),
  })
  process.stdout.write(
    `${routeCourante.padEnd(34)} HTTP ${String(reponse.statusCode)} ${(performance.now() - debut).toFixed(0).padStart(6)} ms, ${String(captures.filter((c) => c.route === routeCourante).length)} requêtes SQL\n`,
  )
}
await app.close()
await pool.end()

// Rejeu sous EXPLAIN ANALYZE.
const client = new pg.Client({ connectionString: urlProprietaire })
await client.connect()
const sortie: string[] = []
const vus = new Set<string>()
for (const capture of captures) {
  if (/^\s*(begin|commit|rollback|set |select pg_advisory)/i.test(capture.sql)) continue
  const cle = `${capture.route}|${capture.sql}`
  if (vus.has(cle)) continue
  vus.add(cle)
  const ecriture = /^\s*(insert|update|delete)/i.test(capture.sql)
  try {
    await client.query('BEGIN')
    const plan = await client.query<Record<string, string>>({
      text: `EXPLAIN (ANALYZE, BUFFERS) ${capture.sql}`,
      values: capture.params,
    })
    sortie.push(
      `=== ${capture.route}\n${capture.sql}\n${plan.rows.map((ligne) => Object.values(ligne).join('')).join('\n')}\n`,
    )
    if (!ecriture) await client.query('COMMIT')
    else await client.query('ROLLBACK')
  } catch (erreur) {
    await client.query('ROLLBACK')
    sortie.push(`=== ${capture.route}\n${capture.sql}\nERREUR ${String(erreur)}\n`)
  }
}
await client.end()
const texte = sortie.join('\n')
if (SORTIE === '') process.stdout.write(texte)
else writeFileSync(SORTIE, texte)
