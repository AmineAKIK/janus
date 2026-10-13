// Prouve l'équivalence de deux versions de l'API : les mêmes requêtes de lecture sur la même base, deux
// serveurs (la référence et le candidat), des réponses qui doivent être identiques à l'octet près une fois
// le JSON relu (seul l'instant de génération de l'export en est retiré).
//
//   node apps/api/bench/serveur.ts --base janus_perf_50k --port 3921        # la référence (autre copie du dépôt)
//   node apps/api/bench/serveur.ts --base janus_perf_50k --port 3922        # le candidat
//   node apps/api/bench/comparer.ts --a http://127.0.0.1:3921 --b http://127.0.0.1:3922 \
//        --db postgres://janus:janus@localhost:5432/janus_perf_50k [--routes aujourdhui,journal]
//
// Sort avec un code non nul au premier écart (et dit lequel).
import { createHash } from 'node:crypto'
import http from 'node:http'
import { isDeepStrictEqual } from 'node:util'
import { nouvelId } from '@janus/contrats'
import { z } from 'zod'
import { contexteDeMesure } from './scenarios.ts'
import pg from 'pg'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}
const A = new URL(option('a', 'http://127.0.0.1:3921'))
const B = new URL(option('b', 'http://127.0.0.1:3922'))
const URL_DB = option('db', 'postgres://janus:janus@localhost:5432/janus_perf_50k')
const FILTRE = option('routes', '')
const agent = new http.Agent({ keepAlive: true, maxSockets: 4 })

interface Reponse {
  readonly statut: number
  readonly corps: string
  readonly cookie: string | undefined
}

function requete(serveur: URL, methode: string, chemin: string, cookie?: string, corps?: unknown) {
  return new Promise<Reponse>((resolve, reject) => {
    const donnees = corps === undefined ? undefined : JSON.stringify(corps)
    const entetes: Record<string, string> = {
      origin: 'https://appli.test',
      accept: 'application/json',
      'x-forwarded-for': `10.2.${String(Math.floor(Math.random() * 250))}.${String(1 + Math.floor(Math.random() * 250))}`,
    }
    if (cookie !== undefined) entetes['cookie'] = cookie
    if (donnees !== undefined) {
      entetes['content-type'] = 'application/json'
      entetes['content-length'] = String(Buffer.byteLength(donnees))
    }
    const req = http.request(
      {
        agent,
        host: serveur.hostname,
        port: serveur.port,
        path: chemin,
        method: methode,
        headers: entetes,
      },
      (res) => {
        const morceaux: Buffer[] = []
        res.on('data', (m: Buffer) => morceaux.push(m))
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
  })
}

async function connecter(serveur: URL): Promise<string> {
  const r = await requete(serveur, 'POST', '/api/session', undefined, {
    nom_utilisateur: 'perf',
    mot_de_passe: 'perf-janus',
    rester_connecte: true,
  })
  if (r.cookie === undefined) throw new Error(`Connexion refusée sur ${serveur.href} : ${r.corps}`)
  return r.cookie
}
const cookieA = await connecter(A)
const cookieB = await connecter(B)
const lireA = async (chemin: string): Promise<unknown> => {
  const brut: unknown = JSON.parse((await requete(A, 'GET', chemin, cookieA)).corps)
  return brut
}
const contexte = await contexteDeMesure(URL_DB, lireA)

const Page = z.object({ suivant: z.string().nullable().optional() })
const Modules = z.object({ modules: z.array(z.object({ id: z.string() })) })
const modules = Modules.parse(
  await lireA(`/api/formations/${contexte.formationId}/modules`),
).modules
const db = new pg.Client({ connectionString: URL_DB })
await db.connect()
const verifications = (
  await db.query<{ id: string }>('SELECT id FROM verifications_tirees ORDER BY id')
).rows
const blocs = (await db.query<{ code: string }>('SELECT code FROM blocs ORDER BY code')).rows
await db.end()

/** Les chemins à comparer, par groupe. */
const groupes: { nom: string; chemins: () => string[] | Promise<string[]> }[] = [
  { nom: 'aujourdhui', chemins: () => ['/api/aujourdhui'] },
  { nom: 'questions-debut', chemins: () => ['/api/questions-debut'] },
  { nom: 'cartes-dues', chemins: () => ['/api/cartes/dues'] },
  {
    nom: 'verification',
    chemins: () => verifications.map(({ id }) => `/api/verifications/${id}`),
  },
  {
    nom: 'tableau-de-bord',
    chemins: () => [
      '/api/tableau-de-bord',
      '/api/tableau-de-bord?periode=7j',
      '/api/tableau-de-bord?periode=30j',
      '/api/tableau-de-bord?periode=tout',
      ...modules.map(({ id }) => `/api/tableau-de-bord?module=${id}&periode=tout`),
    ],
  },
  {
    nom: 'journal',
    chemins: async () => {
      const chemins = [
        '/api/journal',
        ...modules.slice(0, 3).map(({ id }) => `/api/journal?module=${id}`),
      ]
      chemins.push(
        '/api/journal?bloc=B001',
        '/api/journal?type=restitution',
        '/api/journal?type=verification',
      )
      // Trois pages en suivant le curseur.
      let avant: string | null | undefined
      for (let page = 0; page < 3; page += 1) {
        const chemin =
          avant === undefined || avant === null
            ? '/api/journal'
            : `/api/journal?avant=${encodeURIComponent(avant)}`
        if (page > 0) chemins.push(chemin)
        avant = Page.parse(await lireA(chemin)).suivant
        if (avant === null || avant === undefined) break
      }
      return chemins
    },
  },
  { nom: 'journal-export', chemins: () => ['/api/journal/export.txt'] },
  {
    nom: 'blocs',
    chemins: () =>
      blocs.filter((_, rang) => rang % 7 === 0).map(({ code }) => `/api/blocs/${code}`),
  },
  { nom: 'export-json', chemins: () => ['/api/export.json'] },
]

/** Retire ce qui change d'une réponse à l'autre sans changer le sens : l'instant de génération de l'export. */
function normaliser(chemin: string, texte: string): unknown {
  if (chemin.endsWith('.txt')) return texte
  const lu: unknown = JSON.parse(texte)
  const export_ = z.looseObject({ genere_le: z.string() }).safeParse(lu)
  if (chemin === '/api/export.json' && export_.success) {
    return Object.fromEntries(Object.entries(export_.data).filter(([cle]) => cle !== 'genere_le'))
  }
  return lu
}
const empreinte = (valeur: unknown) =>
  createHash('sha256').update(JSON.stringify(valeur)).digest('hex').slice(0, 12)

let ecarts = 0
let total = 0
async function comparerTout(): Promise<void> {
  for (const groupe of groupes) {
    if (FILTRE !== '' && !FILTRE.split(',').some((f) => groupe.nom.includes(f))) continue
    const chemins = await groupe.chemins()
    let egaux = 0
    for (const chemin of chemins) {
      const [a, b] = [
        await requete(A, 'GET', chemin, cookieA),
        await requete(B, 'GET', chemin, cookieB),
      ]
      total += 1
      const [na, nb] =
        a.statut === 200 && b.statut === 200
          ? [normaliser(chemin, a.corps), normaliser(chemin, b.corps)]
          : [a.corps, b.corps]
      if (a.statut === b.statut && isDeepStrictEqual(na, nb)) {
        egaux += 1
      } else {
        ecarts += 1
        process.stdout.write(
          `ÉCART ${chemin} : statut ${String(a.statut)} / ${String(b.statut)}, empreintes ${empreinte(na)} / ${empreinte(nb)}\n`,
        )
      }
    }
    process.stdout.write(
      `${groupe.nom.padEnd(18)} ${String(egaux)}/${String(chemins.length)} identiques\n`,
    )
  }
}

/** Des écritures faites par la référence seule : le candidat, qui garde des états en mémoire, doit les voir. */
let ms = Date.now()
const nouvelleId = () => nouvelId(ms++)
const ecritures: { nom: string; faire: () => Promise<Reponse> }[] = [
  {
    nom: 'forcer B010',
    faire: () =>
      requete(A, 'POST', '/api/blocs/B010/forcer', cookieA, {
        action: 'forcer',
        id: nouvelleId(),
        statut: 'acquis',
        raison: 'Je maîtrise déjà ce bloc.',
      }),
  },
  ...['B001', 'B050', 'B120'].map((bloc) => ({
    nom: `étape vue ${bloc}`,
    faire: () =>
      requete(A, 'POST', '/api/evenements', cookieA, {
        id: nouvelleId(),
        type: 'etape.vue',
        bloc,
        etape: 'ET1',
        version: 1,
        t: new Date().toISOString(),
      }),
  })),
  {
    nom: 'lever le forçage',
    faire: () =>
      requete(A, 'POST', '/api/blocs/B010/forcer', cookieA, { action: 'lever', id: nouvelleId() }),
  },
  {
    nom: 'noter une carte',
    faire: () =>
      requete(A, 'POST', `/api/cartes/${contexte.idCarte}/note`, cookieA, {
        id: nouvelleId(),
        note: 'bien',
      }),
  },
]

await comparerTout()
if (option('ecrire', '') !== '') {
  for (const ecriture of ecritures) {
    const ecrite = await ecriture.faire()
    process.stdout.write(`écriture « ${ecriture.nom} » : ${String(ecrite.statut)}\n`)
    if (ecrite.statut >= 300) process.exit(2)
    await comparerTout()
  }
}
agent.destroy()
process.stdout.write(`${String(total - ecarts)}/${String(total)} réponses identiques\n`)
process.exit(ecarts === 0 ? 0 : 1)
