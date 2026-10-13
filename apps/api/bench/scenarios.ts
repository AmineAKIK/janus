// Les scénarios de mesure : une requête par route de l'API, avec des identifiants tirés de la base de mesure.
import { nouvelId } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import pg from 'pg'
import { horlogeSysteme } from '../src/horloge.ts'
import { z } from 'zod'

export interface Scenario {
  readonly nom: string
  readonly methode: 'GET' | 'POST' | 'PUT'
  readonly chemin: () => string
  readonly corps?: () => object
}

const Formations = z.object({ formations: z.array(z.object({ id: z.string(), code: z.string() })) })
const Modules = z.object({ modules: z.array(z.object({ id: z.string() })) })

/** Ce qu'il faut savoir de la base pour viser des lignes qui existent. */
export async function contexteDeMesure(
  urlDb: string,
  lire: (chemin: string) => Promise<unknown>,
): Promise<{ formationId: string; moduleId: string; idVerification: string; idCarte: string }> {
  const formations = Formations.parse(await lire('/api/formations'))
  const formationId = formations.formations.find(({ code }) => code === 'PERF')?.id ?? ''
  const modules = Modules.parse(await lire(`/api/formations/${formationId}/modules`))
  const moduleId = modules.modules[0]?.id ?? ''
  const db = new pg.Client({ connectionString: urlDb })
  await db.connect()
  const verification = await db.query<{ id: string }>('SELECT id FROM verifications_tirees LIMIT 1')
  const carte = await db.query<{ bloc: string; carte: string }>(
    'SELECT b.code AS bloc, c.carte_id AS carte FROM cartes c JOIN blocs b ON b.id = c.bloc_id ORDER BY b.code LIMIT 1',
  )
  await db.end()
  return {
    formationId,
    moduleId,
    idVerification: verification.rows[0]?.id ?? '',
    idCarte: `${carte.rows[0]?.bloc ?? ''}:${carte.rows[0]?.carte ?? ''}`,
  }
}

export function scenarios(contexte: {
  formationId: string
  moduleId: string
  idVerification: string
  idCarte: string
}): Scenario[] {
  let ms = instantEnMs(horlogeSysteme.maintenant())
  const nouvelleId = () => nouvelId(ms++)
  const blocAleatoire = () => `B${String(1 + Math.floor(Math.random() * 200)).padStart(3, '0')}`
  return [
    { nom: 'sante', methode: 'GET', chemin: () => '/api/sante' },
    { nom: 'moi', methode: 'GET', chemin: () => '/api/moi' },
    { nom: 'formations', methode: 'GET', chemin: () => '/api/formations' },
    {
      nom: 'modules',
      methode: 'GET',
      chemin: () => `/api/formations/${contexte.formationId}/modules`,
    },
    {
      nom: 'blocs-du-module',
      methode: 'GET',
      chemin: () => `/api/modules/${contexte.moduleId}/blocs`,
    },
    { nom: 'bloc', methode: 'GET', chemin: () => `/api/blocs/${blocAleatoire()}` },
    { nom: 'aujourdhui', methode: 'GET', chemin: () => '/api/aujourdhui' },
    { nom: 'questions-debut', methode: 'GET', chemin: () => '/api/questions-debut' },
    { nom: 'cartes-dues', methode: 'GET', chemin: () => '/api/cartes/dues' },
    {
      nom: 'verification',
      methode: 'GET',
      chemin: () => `/api/verifications/${contexte.idVerification}`,
    },
    { nom: 'tableau-de-bord', methode: 'GET', chemin: () => '/api/tableau-de-bord' },
    {
      nom: 'tableau-de-bord?periode=30j',
      methode: 'GET',
      chemin: () => '/api/tableau-de-bord?periode=30j',
    },
    { nom: 'journal', methode: 'GET', chemin: () => '/api/journal' },
    { nom: 'journal/export.txt', methode: 'GET', chemin: () => '/api/journal/export.txt' },
    { nom: 'export.json', methode: 'GET', chemin: () => '/api/export.json' },
    { nom: 'reglages', methode: 'GET', chemin: () => '/api/reglages' },
    { nom: 'sessions', methode: 'GET', chemin: () => '/api/sessions' },
    {
      nom: 'evenements temps.actif',
      methode: 'POST',
      chemin: () => '/api/evenements',
      corps: () => ({ id: nouvelleId(), type: 'temps.actif', bloc: blocAleatoire(), secondes: 60 }),
    },
    {
      nom: 'evenements etape.vue',
      methode: 'POST',
      chemin: () => '/api/evenements',
      corps: () => ({
        id: nouvelleId(),
        type: 'etape.vue',
        bloc: blocAleatoire(),
        etape: 'ET1',
        version: 1,
        t: horlogeSysteme.maintenant(),
      }),
    },
    {
      nom: 'cartes/:id/note',
      methode: 'POST',
      chemin: () => `/api/cartes/${contexte.idCarte}/note`,
      corps: () => ({ id: nouvelleId(), note: 'bien' }),
    },
    {
      nom: 'journal/idees',
      methode: 'POST',
      chemin: () => '/api/journal/idees',
      corps: () => ({ id: nouvelleId(), texte: 'Une idée de mesure' }),
    },
  ]
}
