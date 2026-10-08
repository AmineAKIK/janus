import { Fait } from '@janus/contrats'
import { and, eq, inArray } from 'drizzle-orm'
import * as t from './schema/index.ts'
import { instantIso } from './instant.ts'
import type { Db, Tx } from './transaction.ts'

/** Les types de fait que `evenements` garde : le reste vit dans sa table (corrections, forçages, décisions). */
const TYPES_DES_EVENEMENTS: ReadonlySet<string> = new Set([
  'bloc_ouvert',
  'etape_vue',
  'pratique_resultat',
  'atelier_resultat',
  'aisance_resultat',
  'correction_contestee',
  'correction_tranchee',
  'verification_terminee',
])

export interface BlocCible {
  readonly id: string
  readonly code: string
}

/**
 * Tous les faits d'un utilisateur sur des blocs, rassemblés depuis leurs tables et rendus tels que le
 * moteur les lit. Chaque fait passe par le schéma `Fait` : une ligne illisible arrête tout.
 */
export async function lireFaits(
  lecteur: Db | Tx,
  userId: string,
  blocs: readonly BlocCible[],
): Promise<Fait[]> {
  if (blocs.length === 0) return []
  const codes = new Map(blocs.map(({ id, code }) => [id, code]))
  const ids = [...codes.keys()]
  const codeDe = (blocId: string): string => codes.get(blocId) ?? blocId

  const [evenements, corrections, forces, decisions] = await Promise.all([
    lecteur
      .select({
        id: t.evenements.id,
        blocId: t.evenements.blocId,
        type: t.evenements.type,
        donnees: t.evenements.donnees,
        date: instantIso(t.evenements.dateServeur),
      })
      .from(t.evenements)
      .where(and(eq(t.evenements.userId, userId), inArray(t.evenements.blocId, ids))),
    lecteur
      .select({
        id: t.corrections.id,
        blocId: t.corrections.blocId,
        serie: t.corrections.serie,
        question: t.corrections.questionId,
        tour: t.corrections.tour,
        niveau: t.corrections.niveau,
        compte: t.corrections.compte,
        raisonNonCompte: t.corrections.raisonNonCompte,
        confiance: t.corrections.confiance,
        erreursIa: t.corrections.erreursIds,
        date: instantIso(t.corrections.dateServeur),
      })
      .from(t.corrections)
      .where(and(eq(t.corrections.userId, userId), inArray(t.corrections.blocId, ids))),
    lecteur
      .select({
        id: t.statutsForces.id,
        blocId: t.statutsForces.blocId,
        action: t.statutsForces.action,
        statut: t.statutsForces.statut,
        raison: t.statutsForces.raison,
        date: instantIso(t.statutsForces.dateServeur),
      })
      .from(t.statutsForces)
      .where(and(eq(t.statutsForces.userId, userId), inArray(t.statutsForces.blocId, ids))),
    lecteur
      .select({
        id: t.decisionsErreurs.id,
        blocId: t.decisionsErreurs.blocId,
        erreur: t.decisionsErreurs.erreurId,
        decision: t.decisionsErreurs.decision,
        source: t.decisionsErreurs.source,
        correction: t.decisionsErreurs.correctionId,
        date: instantIso(t.decisionsErreurs.dateServeur),
      })
      .from(t.decisionsErreurs)
      .where(and(eq(t.decisionsErreurs.userId, userId), inArray(t.decisionsErreurs.blocId, ids))),
  ])

  const faits: unknown[] = []
  for (const ligne of evenements) {
    if (!TYPES_DES_EVENEMENTS.has(ligne.type)) continue
    faits.push({
      ...(typeof ligne.donnees === 'object' ? ligne.donnees : {}),
      id: ligne.id,
      bloc: codeDe(ligne.blocId),
      date: ligne.date,
      type: ligne.type,
    })
  }
  for (const ligne of corrections) {
    faits.push({
      id: ligne.id,
      bloc: codeDe(ligne.blocId),
      date: ligne.date,
      type: 'correction',
      serie: ligne.serie,
      question: ligne.question,
      tour: ligne.tour,
      niveau: ligne.niveau,
      compte: ligne.compte,
      ...(ligne.raisonNonCompte === null ? {} : { raisonNonCompte: ligne.raisonNonCompte }),
      confiance: ligne.confiance,
      erreursIa: ligne.erreursIa,
    })
  }
  for (const ligne of forces) {
    const commun = { id: ligne.id, bloc: codeDe(ligne.blocId), date: ligne.date }
    faits.push(
      ligne.action === 'forcer'
        ? { ...commun, type: 'statut_force', statut: ligne.statut, raison: ligne.raison }
        : { ...commun, type: 'force_levee' },
    )
  }
  for (const ligne of decisions) {
    const commun = { id: ligne.id, bloc: codeDe(ligne.blocId), date: ligne.date }
    if (ligne.decision === 'cochee' || ligne.decision === 'decochee') {
      faits.push({
        ...commun,
        type: ligne.decision === 'cochee' ? 'erreur_cochee' : 'erreur_decochee',
        erreur: ligne.erreur,
        source: ligne.source,
      })
    } else {
      faits.push({
        ...commun,
        type: 'erreur_ia_tranchee',
        correction: ligne.correction,
        erreur: ligne.erreur,
        decision: ligne.decision,
      })
    }
  }
  return faits.map((fait) => Fait.parse(fait))
}
