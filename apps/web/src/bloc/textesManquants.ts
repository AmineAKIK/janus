import type { Manque, Statut } from '@janus/contrats'
import { formaterInstant, formaterJour } from './instant.ts'

const liste = (elements: readonly string[] | undefined) => (elements ?? []).join(', ')

/**
 * Une phrase par code de manque du moteur. `maintenant` sert à écrire les heures (« 15 h 20 »,
 * précédée de la date si ce n'est pas aujourd'hui).
 */
export function texteManque(manque: Manque, maintenant: string): string {
  const quand = manque.apres === undefined ? '' : formaterInstant(manque.apres, maintenant)
  switch (manque.code) {
    case 'restitution_incomplete':
      return manque.questions === undefined
        ? 'Envoie ta réponse à toutes les questions de restitution.'
        : `Envoie ta réponse aux questions de restitution : ${liste(manque.questions)}.`
    case 'consolidation_trop_tot':
      return `La consolidation sera possible à partir de ${quand}.`
    case 'consolidation_a_faire':
      return 'Fais la consolidation, sans rouvrir le cours.'
    case 'consolidation_cours_rouvert':
      return 'Tu as rouvert le cours pendant la restitution : refais la consolidation sans le cours.'
    case 'consolidation_insuffisante':
      return `Atteins le seuil à la consolidation : ${String(manque.points ?? 0)} points sur ${String(manque.requis ?? 0)} requis.`
    case 'pratique_aide':
      return manque.exercices === undefined
        ? 'Refais sans aide les exercices de la pratique.'
        : `Refais sans aide les exercices : ${liste(manque.exercices)}.`
    case 'atelier_manquant':
      return 'Fais l’atelier.'
    case 'erreur_ouverte':
      return manque.erreurs === undefined
        ? 'Réussis une question sur chaque erreur ouverte.'
        : `Réussis une question sur chaque erreur ouverte : ${liste(manque.erreurs)}.`
    case 'verification_a_venir':
      return `La vérification sera possible à partir de ${quand}.`
    case 'verification_a_faire':
      return 'Passe la vérification.'
    case 'retest_a_venir':
      return `Le retest sera possible à partir de ${quand}.`
    case 'retest_a_faire':
      return 'Passe le retest.'
    case 'aisance_non_atteinte':
      return 'Atteins l’aisance sur les exercices chronométrés.'
  }
}

/** Le statut visé par ce qui manque, ou `null` quand il n'y en a plus. */
export const STATUT_SUIVANT: Readonly<Record<Statut, Statut | null>> = {
  non_commence: 'en_cours',
  en_cours: 'vu',
  vu: 'acquis_provisoirement',
  acquis_provisoirement: 'acquis',
  acquis: 'maitrise',
  maitrise: null,
  a_reprendre: 'en_cours',
}

export const TEXTES_ENCARTS = {
  consolidationTitre: (heure: string) => `Consolidation disponible à ${heure}`,
  consolidationAide: (delai: string) =>
    `Au moins ${delai} après la restitution. On te le rappellera sur Aujourd’hui.`,
  bilanStatut: 'Statut calculé',
  bilanPour: (statut: string) => `Pour passer à ${statut}`,
  bilanRien: 'Rien ne manque pour le moment.',
  jour: formaterJour,
} as const
