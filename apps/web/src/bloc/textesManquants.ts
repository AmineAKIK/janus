import type { Manque, Statut } from '@janus/contrats'
import { formaterInstant } from './instant.ts'

/** Un nombre à la française : « 0,5 », jamais « 0.5 ». */
const nombre = (valeur: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(valeur)

/** « a », « a et b », « a, b et c ». */
const enumerer = (elements: readonly string[]) =>
  elements.length < 2
    ? elements.join('')
    : `${elements.slice(0, -1).join(', ')} et ${elements.at(-1) ?? ''}`

/** Les noms lisibles d'un bloc, depuis son manifeste ; sans eux, l'identifiant. */
export interface Libelles {
  readonly erreur?: (id: string) => string
  readonly exercice?: (id: string) => string
  readonly question?: (id: string) => string
}
const identifiant = (id: string) => id

/**
 * Une phrase par code de manque du moteur, avec les noms que l'apprenant lit dans la fiche (jamais
 * un identifiant comme « PR1 » quand le manifeste en donne le nom). `maintenant` sert à écrire les
 * heures (« 15 h 20 », précédée de la date si ce n'est pas aujourd'hui) dans le `fuseau` des réglages.
 */
export function texteManque(
  manque: Manque,
  maintenant: string,
  libelles: Libelles = {},
  fuseau?: string,
): string {
  const quand = manque.apres === undefined ? '' : formaterInstant(manque.apres, maintenant, fuseau)
  switch (manque.code) {
    case 'restitution_incomplete':
      return manque.questions === undefined
        ? 'Envoie ta réponse à toutes les questions de restitution.'
        : `Envoie ta réponse ${manque.questions.length > 1 ? 'aux questions' : 'à la question'} ${enumerer(manque.questions.map(libelles.question ?? identifiant))} de la restitution.`
    case 'consolidation_trop_tot':
      return `La consolidation sera possible à partir de ${quand}.`
    case 'consolidation_a_faire':
      return 'Fais la consolidation, sans rouvrir le cours.'
    case 'consolidation_cours_rouvert':
      return 'Tu as rouvert le cours : la consolidation reste possible une fois le délai écoulé.'
    case 'consolidation_insuffisante':
      return `Atteins le seuil à la consolidation : ${nombre(manque.points ?? 0)} ${(manque.points ?? 0) < 2 ? 'point' : 'points'} sur ${nombre(manque.requis ?? 0)} requis.`
    case 'pratique_aide':
      return manque.exercices === undefined
        ? 'Réussis sans aide les exercices de la pratique.'
        : `Réussis sans aide ${manque.exercices.length > 1 ? 'les exercices' : 'l’exercice'} ${enumerer(manque.exercices.map(libelles.exercice ?? identifiant))}.`
    case 'atelier_manquant':
      return 'Fais l’atelier.'
    case 'erreur_ouverte':
      return manque.erreurs === undefined
        ? 'Réussis une question sur chaque erreur ouverte.'
        : `Réussis une question sur chaque erreur ouverte : ${enumerer(manque.erreurs.map(libelles.erreur ?? identifiant))}.`
    case 'verification_a_venir':
      return `La vérification sera possible à partir de ${quand}.`
    case 'verification_a_faire':
      return 'Passe la vérification.'
    case 'retest_a_venir':
      return `Le retest sera possible à partir de ${quand}.`
    case 'retest_a_faire':
      return 'Passe le retest.'
    case 'reprise_a_faire':
      return 'Deux relances ratées de suite : refais la restitution et la pratique, sans aide.'
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
  trancherD: 'Tranche d’abord l’erreur repérée ci-dessous.',
} as const
