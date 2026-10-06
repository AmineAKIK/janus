import type { Manque, Statut } from '@janus/contrats'
import { formaterDate } from '../format.ts'

export interface EntreeEcheance {
  readonly statut: Statut
  readonly manque: readonly Manque[]
  /** Les libellés des erreurs critiques ouvertes. */
  readonly erreursOuvertes: readonly string[]
  /** L'étape où la page s'est arrêtée, si on la connaît. */
  readonly etape: { readonly rang: number; readonly total: number } | null
  /** Les prérequis qui ne sont pas au moins « acquis provisoirement ». */
  readonly prerequisManquants: readonly string[]
  /** Le jour d'aujourd'hui, « AAAA-MM-JJ ». */
  readonly aujourdhui: string
  /** Convertit une date du serveur (jour ou instant) en jour « AAAA-MM-JJ ». */
  readonly enJour: (date: string) => string
}

export interface LigneEcheance {
  /** Le texte à droite de la carte. */
  readonly date: string | null
  /** Le libellé de l'erreur ouverte, sous le titre. */
  readonly erreur: string | null
  /** « prérequis : B03 », sous le titre. */
  readonly prerequis: string | null
}

const AUCUNE: LigneEcheance = { date: null, erreur: null, prerequis: null }

function trouver(manque: readonly Manque[], ...codes: Manque['code'][]): Manque | undefined {
  return manque.find(({ code }) => codes.includes(code))
}

function datee(mot: string, manque: Manque, entree: EntreeEcheance): string {
  if (manque.apres === undefined || manque.code.endsWith('_a_faire')) return `${mot} aujourd’hui`
  const date = formaterDate(entree.enJour(manque.apres), entree.aujourdhui)
  return date === 'aujourd’hui' || date === 'demain' ? `${mot} ${date}` : `${mot} le ${date}`
}

/** Ce que la carte d'un bloc annonce, par priorité : erreur, vérification ou retest, consolidation, restitution, étape, prérequis. */
export function ligneEcheance(entree: EntreeEcheance): LigneEcheance {
  const { manque, statut } = entree
  const premiereErreur = entree.erreursOuvertes[0]
  if (premiereErreur !== undefined) {
    return { date: 'à reprendre', erreur: premiereErreur, prerequis: null }
  }

  const verification = trouver(manque, 'verification_a_faire', 'verification_a_venir')
  if (verification !== undefined) {
    return { ...AUCUNE, date: datee('vérification', verification, entree) }
  }
  const retest = trouver(manque, 'retest_a_faire', 'retest_a_venir')
  if (retest !== undefined) return { ...AUCUNE, date: datee('retest', retest, entree) }

  const consolidation = trouver(
    manque,
    'consolidation_trop_tot',
    'consolidation_a_faire',
    'consolidation_cours_rouvert',
    'consolidation_insuffisante',
  )
  if (consolidation !== undefined) {
    return {
      ...AUCUNE,
      date:
        consolidation.code === 'consolidation_trop_tot'
          ? datee('consolidation', consolidation, entree)
          : 'consolidation à faire',
    }
  }

  const restitutionAFaire =
    (statut === 'en_cours' || statut === 'vu') &&
    manque.some(({ code }) => code === 'restitution_incomplete')
  if (restitutionAFaire) return { ...AUCUNE, date: 'restitution à faire' }

  if (entree.etape !== null) {
    return {
      ...AUCUNE,
      date: `étape ${String(entree.etape.rang)} sur ${String(entree.etape.total)}`,
    }
  }

  if (entree.prerequisManquants.length > 0) {
    return { ...AUCUNE, prerequis: `prérequis : ${entree.prerequisManquants.join(', ')}` }
  }
  return AUCUNE
}
