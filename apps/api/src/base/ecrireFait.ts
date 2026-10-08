import type { Fait } from '@janus/contrats'
import * as t from './schema/index.ts'
import type { Db } from './transaction.ts'

const HASH = 'e'.repeat(64)

export interface ContexteEcriture {
  readonly db: Db
  readonly userId: string
  readonly blocId: string
  readonly ficheVersionId: string
  readonly identifiant: () => string
}

/**
 * Aide des tests d'intégration : écrit un fait du moteur dans la table qui le porte, à sa date,
 * sous les identifiants de la base. `ids` fait le lien entre l'identifiant du fait et celui de la ligne.
 */
export async function ecrireFait(
  { db, userId, blocId, ficheVersionId, identifiant }: ContexteEcriture,
  fait: Fait,
  ids: Map<string, string>,
  rang: number,
): Promise<void> {
  // Le serveur ignore un message déjà reçu : le doublon n'ajoute rien.
  if (ids.has(fait.id)) return
  const id = identifiant()
  ids.set(fait.id, id)
  const liens = { id, userId, blocId, dateServeur: fait.date }
  const donnees = Object.fromEntries(
    Object.entries(fait).filter(([cle]) => !['id', 'bloc', 'date', 'type'].includes(cle)),
  )
  switch (fait.type) {
    case 'correction':
      await db.insert(t.corrections).values({
        ...liens,
        questionId: fait.question,
        serie: fait.serie,
        tentative: rang,
        tour: fait.tour,
        confiance: fait.confiance,
        reponse: 'réponse',
        supportColle: false,
        supportRetourCours: false,
        recopiee: fait.raisonNonCompte === 'recopiee',
        message: 'message',
        niveau: fait.niveau,
        erreursIds: fait.erreursIa,
        source: 'support',
        ref: 'ref',
        certitude: 'sur',
        compte: fait.compte,
        raisonNonCompte: fait.raisonNonCompte ?? null,
        conteste: false,
        modele: 'modele',
        parametres: {},
        jetonsEntree: 0,
        jetonsSortie: 0,
        coutMillioniemes: 0,
        consigneEmpreinte: HASH,
      })
      return
    case 'statut_force':
      await db
        .insert(t.statutsForces)
        .values({ ...liens, action: 'forcer', statut: fait.statut, raison: fait.raison })
      return
    case 'force_levee':
      await db.insert(t.statutsForces).values({ ...liens, action: 'lever' })
      return
    case 'erreur_cochee':
    case 'erreur_decochee':
      await db.insert(t.decisionsErreurs).values({
        ...liens,
        erreurId: fait.erreur,
        decision: fait.type === 'erreur_cochee' ? 'cochee' : 'decochee',
        source: fait.source,
      })
      return
    case 'erreur_ia_tranchee':
      await db.insert(t.decisionsErreurs).values({
        ...liens,
        erreurId: fait.erreur,
        decision: fait.decision,
        correctionId: ids.get(fait.correction) ?? null,
      })
      return
    default: {
      const lien =
        fait.type === 'correction_contestee' || fait.type === 'correction_tranchee'
          ? { correction: ids.get(fait.correction) }
          : {}
      await db.insert(t.evenements).values({
        ...liens,
        ficheVersionId,
        type: fait.type,
        donnees: { ...donnees, ...lien },
        empreinte: HASH,
        aide: 'aide' in fait ? fait.aide : null,
      })
    }
  }
}
