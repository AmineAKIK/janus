import { Fait } from '@janus/contrats'
import { and, inArray } from 'drizzle-orm'
import * as t from './schema/index.ts'
import { instantIso } from './instant.ts'
import { deLUtilisateurSurLesBlocs, niveauRetenu } from './requetes.ts'
import type { Db, Tx } from './transaction.ts'

type TypeDeFait = Fait['type']

/** Les types de fait que `evenements` garde : le reste vit dans sa table (corrections, forçages, décisions). */
export const TYPES_DES_EVENEMENTS: readonly TypeDeFait[] = [
  'bloc_ouvert',
  'etape_vue',
  'fiche_recommencee',
  'pratique_resultat',
  'atelier_resultat',
  'aisance_resultat',
  'correction_contestee',
  'correction_tranchee',
  'verification_terminee',
]
const TYPES_DES_FORCAGES: readonly TypeDeFait[] = ['statut_force', 'force_levee']
const TYPES_DES_DECISIONS: readonly TypeDeFait[] = [
  'erreur_cochee',
  'erreur_decochee',
  'erreur_ia_tranchee',
]

export interface BlocCible {
  readonly id: string
  readonly code: string
}

/**
 * Les faits d'un utilisateur sur des blocs, rassemblés depuis leurs tables et rendus tels que le
 * moteur les lit. Chaque fait passe par le schéma `Fait` : une ligne illisible arrête tout.
 *
 * Sans `types`, tous les faits. Avec `types`, seulement ceux-là (le même résultat que de filtrer
 * ensuite) et PostgreSQL ne lit que les tables et les types d'événements concernés. Les événements
 * que le moteur ignore (temps actif, réponses du pré-test…), de loin les plus nombreux, ne sont
 * jamais demandés.
 */
export async function lireFaits(
  lecteur: Db | Tx,
  userId: string,
  blocs: readonly BlocCible[],
  types?: readonly TypeDeFait[],
): Promise<Fait[]> {
  if (blocs.length === 0) return []
  const voulus = types === undefined ? undefined : new Set<TypeDeFait>(types)
  const voulu = (type: TypeDeFait) => voulus === undefined || voulus.has(type)
  const typesDesEvenements = TYPES_DES_EVENEMENTS.filter(voulu)
  const codes = new Map(blocs.map(({ id, code }) => [id, code]))
  const ids = [...codes.keys()]
  const codeDe = (blocId: string): string => codes.get(blocId) ?? blocId

  const [evenements, corrections, forces, decisions] = await Promise.all([
    typesDesEvenements.length === 0
      ? []
      : lecteur
          .select({
            id: t.evenements.id,
            blocId: t.evenements.blocId,
            type: t.evenements.type,
            donnees: t.evenements.donnees,
            date: instantIso(t.evenements.dateServeur),
          })
          .from(t.evenements)
          .where(
            and(
              deLUtilisateurSurLesBlocs(t.evenements, userId, ids),
              inArray(t.evenements.type, typesDesEvenements),
            ),
          ),
    !voulu('correction')
      ? []
      : lecteur
          .select({
            id: t.corrections.id,
            blocId: t.corrections.blocId,
            serie: t.corrections.serie,
            question: t.corrections.questionId,
            tour: t.corrections.tour,
            niveau: niveauRetenu,
            compte: t.corrections.compte,
            raisonNonCompte: t.corrections.raisonNonCompte,
            confiance: t.corrections.confiance,
            erreursIa: t.corrections.erreursIds,
            date: instantIso(t.corrections.dateServeur),
          })
          .from(t.corrections)
          .where(deLUtilisateurSurLesBlocs(t.corrections, userId, ids)),
    !TYPES_DES_FORCAGES.some(voulu)
      ? []
      : lecteur
          .select({
            id: t.statutsForces.id,
            blocId: t.statutsForces.blocId,
            action: t.statutsForces.action,
            statut: t.statutsForces.statut,
            raison: t.statutsForces.raison,
            date: instantIso(t.statutsForces.dateServeur),
          })
          .from(t.statutsForces)
          .where(deLUtilisateurSurLesBlocs(t.statutsForces, userId, ids)),
    !TYPES_DES_DECISIONS.some(voulu)
      ? []
      : lecteur
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
          .where(deLUtilisateurSurLesBlocs(t.decisionsErreurs, userId, ids)),
  ])

  const faits: unknown[] = []
  for (const ligne of evenements) {
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
    const type: TypeDeFait = ligne.action === 'forcer' ? 'statut_force' : 'force_levee'
    if (!voulu(type)) continue
    faits.push(
      type === 'statut_force'
        ? { ...commun, type, statut: ligne.statut, raison: ligne.raison }
        : { ...commun, type },
    )
  }
  for (const ligne of decisions) {
    const commun = { id: ligne.id, bloc: codeDe(ligne.blocId), date: ligne.date }
    if (ligne.decision === 'cochee' || ligne.decision === 'decochee') {
      const type = ligne.decision === 'cochee' ? 'erreur_cochee' : 'erreur_decochee'
      if (!voulu(type)) continue
      faits.push({ ...commun, type, erreur: ligne.erreur, source: ligne.source })
    } else if (voulu('erreur_ia_tranchee')) {
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
