import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Reglages } from '@janus/contrats'
import { z } from 'zod'
import { creerFaux } from '../adaptateurs/correcteur/faux.ts'
import { creerBase } from '../base/base.ts'
import { lireConfig } from '../config.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { horlogeFausse } from '../testeur.ts'
import { creerServeur } from '../serveur.ts'
import { planterLaGraine } from './graine.ts'

// Le banc de la CI (PR-089) : l'API réelle, sur un vrai PostgreSQL, avec le faux correcteur, un
// compte et la graine de la démo, et une horloge que l'on règle par une route réservée au banc.
// Ce fichier n'est lancé que par `pnpm banc` : ni `demarrer.ts` ni rien de la production ne l'importe
// (un test le vérifie), donc ces routes n'existent pas en production.

const PORT_PAR_DEFAUT = 3100
const DEBUT = '2026-06-01T10:00:00.000Z'
/** Tout ce qu'un parcours écrit : on le vide entre deux scénarios, le plan et les fiches restent. */
const TABLES_A_VIDER = [
  'abonnements_push',
  'budget_ia',
  'corrections_echecs',
  'decisions_erreurs',
  'corrections',
  'echeances',
  'etats_page',
  'evenements',
  'idees',
  'journal',
  'notes_cartes',
  'notes_journal',
  'rappels_envoyes',
  'revues_fsrs',
  'revues_methode',
  'series_questions_debut',
  'sessions_activite',
  'sessions_revoquees',
  'sessions',
  'statuts_courants',
  'statuts_forces',
  'verifications_tirees',
]
const DEUX_MINUTES_MS = 120_000
const Avancer = z.strictObject({ ms: z.number().int().min(0) })

const config = lireConfig({
  ORIGINE_APPLI: 'http://localhost:4173',
  FICHES_URL: 'http://localhost:3100/fiches',
  COOKIE_SECURE: 'false',
  VAPID_PUBLIC_KEY: 'banc',
  VAPID_PRIVATE_KEY: 'banc',
  VAPID_SUJET: 'mailto:banc@example.test',
  NIVEAU_JOURNAL: 'warn',
  ...process.env,
})
const base = creerBase(config.DATABASE_URL)
const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
const horloge = horlogeFausse(DEBUT)
await planterLaGraine(proprietaire, horloge, await mkdtemp(join(tmpdir(), 'janus-banc-')))

const app = await creerServeur(
  { config, horloge, base, proprietaire, correcteur: creerFaux() },
  { hacheur: creerHacheur(4) },
)

// Les routes du banc : publiques, hors du contrat, absentes de la production.
app.post('/api/banc/horloge', { config: { publique: true, identifiant: false } }, (requete) => {
  horloge.avancer(Avancer.parse(requete.body).ms)
  return { maintenant: horloge.maintenant() }
})
app.post(
  '/api/banc/reinitialiser',
  { config: { publique: true, identifiant: false } },
  async () => {
    await proprietaire.executer(`TRUNCATE TABLE ${TABLES_A_VIDER.join(', ')}`)
    await proprietaire.executer('UPDATE users SET reglages = $1, reglages_version = 1', [
      JSON.stringify(Reglages.parse({})),
    ])
    // Le temps ne recule jamais : le limiteur de connexion s'en sert. Deux minutes vident sa fenêtre.
    horloge.avancer(DEUX_MINUTES_MS)
    return { maintenant: horloge.maintenant() }
  },
)

await app.listen({ host: '127.0.0.1', port: Number(process.env['PORT'] ?? PORT_PAR_DEFAUT) })
