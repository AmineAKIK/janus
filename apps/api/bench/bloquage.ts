// Mesure le blocage de la boucle d'événements : pendant qu'une route lourde calcule, combien de temps
// attend une requête légère (la santé, ou l'envoi du temps actif par la page) ?
//
//   node apps/api/bench/bloquage.ts --url http://127.0.0.1:3911 --db postgres://... --route journal
import http from 'node:http'
import { performance } from 'node:perf_hooks'
import { contexteDeMesure, scenarios } from './scenarios.ts'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}
const URL_API = new URL(option('url', 'http://127.0.0.1:3911'))
const URL_DB = option('db', 'postgres://janus:janus@localhost:5432/janus_perf_50k')
const ROUTE = option('route', 'journal')
const agent = new http.Agent({ keepAlive: true, maxSockets: 8 })

function requete(methode: string, chemin: string, cookie?: string, corps?: unknown) {
  return new Promise<{ statut: number; corps: string; cookie: string | undefined }>(
    (resolve, reject) => {
      const donnees = corps === undefined ? undefined : JSON.stringify(corps)
      const entetes: Record<string, string> = {
        origin: 'https://appli.test',
        'x-forwarded-for': `10.1.${String(Math.floor(Math.random() * 250))}.${String(1 + Math.floor(Math.random() * 250))}`,
      }
      if (cookie !== undefined) entetes['cookie'] = cookie
      if (donnees !== undefined) {
        entetes['content-type'] = 'application/json'
        entetes['content-length'] = String(Buffer.byteLength(donnees))
      }
      const req = http.request(
        {
          agent,
          host: URL_API.hostname,
          port: URL_API.port,
          path: chemin,
          method: methode,
          headers: entetes,
        },
        (res) => {
          const morceaux: Buffer[] = []
          res.on('data', (m: Buffer) => {
            morceaux.push(m)
          })
          res.on('end', () => {
            resolve({
              statut: res.statusCode ?? 0,
              corps: Buffer.concat(morceaux).toString('utf8'),
              cookie: res.headers['set-cookie']?.[0]?.split(';')[0],
            })
          })
        },
      )
      req.on('error', reject)
      if (donnees !== undefined) req.write(donnees)
      req.end()
    },
  )
}

const connexion = await requete('POST', '/api/session', undefined, {
  nom_utilisateur: 'perf',
  mot_de_passe: 'perf-janus',
})
const cookie = connexion.cookie
if (cookie === undefined) throw new Error('Connexion refusée')
const liste = scenarios(
  await contexteDeMesure(URL_DB, async (chemin): Promise<unknown> => {
    const brut: unknown = JSON.parse((await requete('GET', chemin, cookie)).corps)
    return brut
  }),
)
const lourde = liste.find(({ nom }) => nom.includes(ROUTE))
if (lourde === undefined) throw new Error(`Route inconnue : ${ROUTE}`)

const etat = { fini: false }
const debut = performance.now()
const calcul = requete(lourde.methode, lourde.chemin(), cookie).then((r) => {
  etat.fini = true
  return r.statut
})
const attentes: number[] = []
while (!etat.fini) {
  const t0 = performance.now()
  await requete('GET', '/api/sante')
  attentes.push(performance.now() - t0)
  await new Promise((resolve) => setTimeout(resolve, 25))
}
const statut = await calcul
attentes.sort((a, b) => a - b)
const p = (q: number) =>
  attentes[Math.min(attentes.length - 1, Math.floor(q * attentes.length))] ?? 0
process.stdout.write(
  `${ROUTE}: HTTP ${String(statut)} en ${(performance.now() - debut).toFixed(0)} ms ; ${String(attentes.length)} sondes /api/sante : p50 ${p(0.5).toFixed(0)} ms, max ${(attentes.at(-1) ?? 0).toFixed(0)} ms\n`,
)
agent.destroy()
