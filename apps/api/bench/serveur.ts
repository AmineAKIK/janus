// Lance l'API réelle sur une base de mesure (voir graine.ts), sans import de catalogue ni tâche de fond :
//
//   node apps/api/bench/serveur.ts --base janus_perf_50k --port 3911
//
// Les variables d'environnement (DATABASE_URL, etc.) l'emportent sur les valeurs par défaut ci-dessous.
import { creerBase } from '../src/base/base.ts'
import { lireConfig } from '../src/config.ts'
import { horlogeSysteme } from '../src/horloge.ts'
import { creerServeur } from '../src/serveur.ts'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}

const BASE = option('base', 'janus_perf_api')
const PORT = Number(option('port', '3911'))
const config = lireConfig({
  DATABASE_URL: `postgres://janus_perf_app:perf@localhost:5432/${BASE}`,
  DATABASE_URL_PROPRIETAIRE: `postgres://janus:janus@localhost:5432/${BASE}`,
  ORIGINE_APPLI: 'https://appli.test',
  FICHES_URL: 'https://fiches.test',
  FICHES_DIR: '/tmp',
  COOKIE_SECURE: 'false',
  VAPID_PUBLIC_KEY:
    'BH64kM1kNQcyW-nJkCvSqACyy3MAH9VeXabetwObewvWYJSXOsEtZpxDfkbquFPgUV6wfI97SNuI6ODkxpveEIg',
  VAPID_PRIVATE_KEY: '3FMImFrGyCvVmzww4mH43WqunhjAoCWkpkoMdZuHOnY',
  VAPID_SUJET: 'mailto:mesure@example.test',
  NIVEAU_JOURNAL: 'warn',
  CONNEXIONS_PAR_ADRESSE_PAR_MINUTE: '100000',
  ...process.env,
})
const base = creerBase(config.DATABASE_URL)
const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
const app = await creerServeur({ config, horloge: horlogeSysteme, base, proprietaire })
await app.listen({ host: '127.0.0.1', port: PORT })
process.stdout.write(`API de mesure sur http://127.0.0.1:${String(PORT)} (base ${BASE})\n`)
