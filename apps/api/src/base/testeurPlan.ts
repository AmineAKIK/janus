import { nouvelId, Reglages } from '@janus/contrats'
import type { Manifeste } from '@janus/contrats'
import { manifesteDuBloc } from '@janus/contrats/demo'
import * as t from './schema/index.ts'
import type { Db } from './transaction.ts'

// Aide des tests d'intégration : un plan de quelques blocs et un utilisateur dans une base de test,
// sans passer par l'import du catalogue (qui ne sait créer que la fiche de démonstration).

const DATE = '2026-09-01T10:00:00.000Z'
const HASH = 'a'.repeat(64)

export interface BlocSeme {
  readonly id: string
  readonly code: string
  readonly versionId: string
  readonly manifeste: Manifeste
}

export interface PlanSeme {
  readonly userId: string
  readonly formationId: string
  readonly blocs: readonly BlocSeme[]
  /** Un identifiant neuf, rangé par date (UUID v7), pour les lignes que le test ajoute. */
  readonly identifiant: () => string
}

/**
 * Une formation, un module importé, un bloc par code (le manifeste de démonstration, au nom du bloc,
 * chaque bloc ayant le précédent pour prérequis) et un utilisateur aux réglages par défaut.
 */
export async function semerPlan(
  db: Db,
  codes: readonly string[],
  options: { readonly reglages?: unknown } = {},
): Promise<PlanSeme> {
  let numero = 0
  const identifiant = () => nouvelId(Date.parse(DATE) + (numero += 1))
  const userId = identifiant()
  const formationId = identifiant()
  const moduleId = identifiant()
  await db.insert(t.users).values({
    id: userId,
    nomUtilisateur: `utilisateur-${userId}`,
    motDePasseHash: 'h',
    reglages: options.reglages ?? Reglages.parse({}),
    creeLe: DATE,
  })
  await db.insert(t.formations).values({ id: formationId, code: 'F', titre: 'Formation' })
  await db.insert(t.modules).values({
    id: moduleId,
    formationId,
    code: 'M1',
    titre: 'Module',
    ordre: 1,
    importe: true,
  })
  const blocs: BlocSeme[] = []
  for (const [rang, code] of codes.entries()) {
    const id = identifiant()
    const versionId = identifiant()
    const manifeste = manifesteDuBloc({
      code,
      titre: `Bloc ${code}`,
      prerequis: rang === 0 ? [] : [codes[rang - 1] ?? ''],
      partie: 'P1',
    })
    await db.insert(t.blocs).values({ id, moduleId, code, titre: `Bloc ${code}`, ordre: rang + 1 })
    await db.insert(t.fichesVersions).values({
      id: versionId,
      blocId: id,
      version: 1,
      empreinte: HASH,
      chemin: `${code}/${HASH}.html`,
      manifeste,
      creeLe: DATE,
    })
    for (const carte of manifeste.cartes) {
      await db.insert(t.cartes).values({
        id: identifiant(),
        blocId: id,
        carteId: carte.id,
        recto: carte.recto,
        verso: carte.verso,
      })
    }
    blocs.push({ id, code, versionId, manifeste })
  }
  return { userId, formationId, blocs, identifiant }
}
