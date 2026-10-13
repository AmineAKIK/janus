// Générateur de charge pour l'API, sans dépendance : connexions HTTP persistantes, latences en percentiles.
//
//   node apps/api/bench/charge.ts --url http://127.0.0.1:3911 --db postgres://janus:janus@localhost:5432/janus_perf_api \
//        [--connexions 16] [--duree 8] [--pid 1234] [--sortie avant.json] [--routes aujourdhui,journal]
//   node apps/api/bench/charge.ts --comparer avant.json apres.json
//
// Pour chaque route : une requête à froid (la première, juste après le démarrage), puis une rampe à une
// connexion (latence « à chaud » sans file d'attente), puis la charge à N connexions (débit et latences).
// `--pid` échantillonne le CPU et la mémoire résidente du processus de l'API pendant la charge.
import { readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { performance } from 'node:perf_hooks'
import { z } from 'zod'
import { contexteDeMesure, scenarios } from './scenarios.ts'
import type { Scenario } from './scenarios.ts'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}

const MesureZ = z.object({
  route: z.string(),
  froid_ms: z.number(),
  connexions: z.number(),
  chaud_p50_ms: z.number(),
  chaud_p95_ms: z.number(),
  charge_rps: z.number(),
  charge_p50_ms: z.number(),
  charge_p95_ms: z.number(),
  charge_p99_ms: z.number(),
  octets: z.number(),
  erreurs: z.number(),
})
type Mesure = z.infer<typeof MesureZ>

if (process.argv[2] === '--comparer') {
  const lire = (fichier: string | undefined): Mesure[] =>
    z.array(MesureZ).parse(JSON.parse(readFileSync(fichier ?? '', 'utf8')))
  const avant = lire(process.argv[3])
  const apres = lire(process.argv[4])
  const ligne = (nom: string, a: number, b: number) =>
    `${nom} ${a.toFixed(1)} -> ${b.toFixed(1)} (${a === 0 ? 'n/a' : `${(((b - a) / a) * 100).toFixed(0)} %`})`
  for (const route of apres) {
    const ancien = avant.find(({ route: r }) => r === route.route)
    if (ancien === undefined) continue
    process.stdout.write(
      `${route.route.padEnd(34)} ${ligne('chaud p50', ancien.chaud_p50_ms, route.chaud_p50_ms)} | ${ligne('rps', ancien.charge_rps, route.charge_rps)} | ${ligne('p95', ancien.charge_p95_ms, route.charge_p95_ms)}\n`,
    )
  }
  process.exit(0)
}

const URL_API = new URL(option('url', 'http://127.0.0.1:3911'))
const URL_DB = option('db', 'postgres://janus:janus@localhost:5432/janus_perf_api')
const CONNEXIONS = Number(option('connexions', '16'))
const DUREE_S = Number(option('duree', '8'))
const PID = option('pid', '')
const ORIGINE = option('origine', 'https://appli.test')
const SORTIE = option('sortie', '')
const FILTRE = option('routes', '')
const SANS = option('sans', '')
  .split(',')
  .filter((nom) => nom !== '')
const agent = new http.Agent({ keepAlive: true, maxSockets: CONNEXIONS + 4 })

interface Reponse {
  readonly statut: number
  readonly octets: number
  readonly corps: string
  readonly cookie: string | undefined
}

function requete(
  methode: string,
  chemin: string,
  cookie: string | undefined,
  corps?: unknown,
): Promise<Reponse> {
  return new Promise((resolve, reject) => {
    const donnees = corps === undefined ? undefined : JSON.stringify(corps)
    // Le plafond général (300 requêtes par minute et par adresse) fausserait la mesure : chaque requête vient d'un client distinct.
    const entetes: Record<string, string> = {
      origin: ORIGINE,
      accept: 'application/json',
      'x-forwarded-for': `10.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}.${String(1 + Math.floor(Math.random() * 250))}`,
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
        res.on('data', (m: Buffer) => morceaux.push(m))
        res.on('end', () => {
          const brut = Buffer.concat(morceaux)
          resolve({
            statut: res.statusCode ?? 0,
            octets: brut.length,
            corps: brut.toString('utf8'),
            cookie: res.headers['set-cookie']?.[0]?.split(';')[0],
          })
        })
      },
    )
    req.on('error', reject)
    if (donnees !== undefined) req.write(donnees)
    req.end()
  })
}

// --- Connexion et découverte des identifiants.
const connexion = await requete('POST', '/api/session', undefined, {
  nom_utilisateur: 'perf',
  mot_de_passe: 'perf-janus',
  rester_connecte: true,
})
if (connexion.cookie === undefined) throw new Error(`Connexion refusée : ${connexion.corps}`)
const cookie = connexion.cookie
const SCENARIOS = scenarios(
  await contexteDeMesure(URL_DB, async (chemin): Promise<unknown> => {
    const brut: unknown = JSON.parse((await requete('GET', chemin, cookie)).corps)
    return brut
  }),
)

function percentile(tries: number[], p: number): number {
  if (tries.length === 0) return 0
  return tries[Math.min(tries.length - 1, Math.floor((p / 100) * tries.length))] ?? 0
}

function cpuMs(): number {
  if (PID === '') return 0
  const champs = readFileSync(`/proc/${PID}/stat`, 'utf8').split(') ')[1]?.split(' ') ?? []
  return ((Number(champs[11]) + Number(champs[12])) / 100) * 1000
}
function rssMo(): number {
  if (PID === '') return 0
  const ligne = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${PID}/status`, 'utf8'))
  return Number(ligne?.[1] ?? 0) / 1024
}

async function boucle(scenario: Scenario, connexions: number, dureeMs: number) {
  const latences: number[] = []
  let erreurs = 0
  let octets = 0
  const debutBoucle = performance.now()
  const fin = debutBoucle + dureeMs
  await Promise.all(
    Array.from({ length: connexions }, async () => {
      while (performance.now() < fin) {
        const debut = performance.now()
        try {
          const r = await requete(scenario.methode, scenario.chemin(), cookie, scenario.corps?.())
          if (r.statut >= 400) erreurs += 1
          octets = r.octets
        } catch {
          erreurs += 1
        }
        latences.push(performance.now() - debut)
      }
    }),
  )
  return {
    latences: latences.sort((a, b) => a - b),
    erreurs,
    octets,
    dureeMs,
    dureeReelMs: performance.now() - debutBoucle,
  }
}

const mesures: Mesure[] = []
for (const scenario of SCENARIOS) {
  if (FILTRE !== '' && !FILTRE.split(',').some((f) => scenario.nom.includes(f))) continue
  if (SANS.some((nom) => scenario.nom.includes(nom))) continue
  const debutFroid = performance.now()
  const premiere = await requete(scenario.methode, scenario.chemin(), cookie, scenario.corps?.())
  const froid = performance.now() - debutFroid
  if (premiere.statut >= 400) {
    process.stdout.write(
      `${scenario.nom}: HTTP ${String(premiere.statut)} ${premiere.corps.slice(0, 160)}\n`,
    )
  }
  await boucle(scenario, 1, 300)
  const chaud = await boucle(scenario, 1, Math.min(3000, DUREE_S * 400))
  // Une route qui occupe le processus plus de 300 ms ne se charge pas en parallèle : la file dépasserait le délai
  // de 15 s de l'API, qui répond 503 sans interrompre le calcul, et la mesure ne dirait plus que cela. Elle est
  // alors mesurée requête après requête (le débit est l'inverse de la latence : un seul fil de calcul).
  const lente = percentile(chaud.latences, 50) > 300
  const connexions = lente ? 1 : CONNEXIONS
  const dureeCharge = lente ? 2.5 * percentile(chaud.latences, 50) : DUREE_S * 1000
  const cpu0 = cpuMs()
  const charge = await boucle(scenario, connexions, dureeCharge)
  const cpu = cpuMs() - cpu0
  const mesure: Mesure = {
    route: `${scenario.methode} ${scenario.nom}`,
    froid_ms: froid,
    connexions,
    chaud_p50_ms: percentile(chaud.latences, 50),
    chaud_p95_ms: percentile(chaud.latences, 95),
    charge_rps: charge.latences.length / (charge.dureeReelMs / 1000),
    charge_p50_ms: percentile(charge.latences, 50),
    charge_p95_ms: percentile(charge.latences, 95),
    charge_p99_ms: percentile(charge.latences, 99),
    octets: charge.octets,
    erreurs: charge.erreurs,
  }
  mesures.push(mesure)
  const cpuPourcent =
    PID === ''
      ? ''
      : ` cpu ${((cpu / charge.dureeReelMs) * 100).toFixed(0)} % rss ${rssMo().toFixed(0)} Mo`
  process.stdout.write(
    `${mesure.route.padEnd(34)} froid ${mesure.froid_ms.toFixed(1).padStart(7)} ms | chaud p50 ${mesure.chaud_p50_ms.toFixed(1).padStart(7)} p95 ${mesure.chaud_p95_ms.toFixed(1).padStart(7)} | ${String(connexions)}c: ${mesure.charge_rps.toFixed(0).padStart(6)} rps p50 ${mesure.charge_p50_ms.toFixed(1).padStart(7)} p95 ${mesure.charge_p95_ms.toFixed(1).padStart(7)} p99 ${mesure.charge_p99_ms.toFixed(1).padStart(7)} | ${String(mesure.octets).padStart(8)} o err ${String(mesure.erreurs)}${cpuPourcent}\n`,
  )
}
if (SORTIE !== '') writeFileSync(SORTIE, JSON.stringify(mesures, null, 2))
agent.destroy()
