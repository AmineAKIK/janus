import type { Periode } from '@janus/contrats'

export const TEXTES_SUIVI = {
  titreEcran: 'Suivi',
  module: 'Module',
  periode: 'Période',
  journal: 'Journal',
  vide: 'Pas encore de données.',
  carte: 'Carte du module',
  legende: 'Légende des statuts',
  prerequisNonValide: 'prérequis non validé',
  redescendu: 'redescendu',
  legendePrerequis: '⚠ prérequis non validé',
  legendeRedescendu: '↩ redescendu',
  aFaire: 'À faire',
  toutVoir: 'Tout voir dans Aujourd’hui',
  erreurs: 'Erreurs critiques récurrentes',
  erreursSousTitre: 'Motifs observés dans les blocs ouverts',
  aReprendre: 'À reprendre',
  decisions: 'Statuts forcés et accès',
  decisionsSousTitre: 'Décisions explicites et auditables',
  sansPrerequis: 'BLOCS OUVERTS SANS PRÉREQUIS',
  forcer: 'Forcer un statut',
  revenir: 'Revenir au statut calculé',
  cout: 'Coût IA',
  budget: 'Budget mensuel de correction',
  dialogueTitre: 'Forcer un statut',
  champBloc: 'Bloc',
  champStatut: 'Statut',
  champRaison: 'Raison',
  raisonAide: 'Au moins 10 caractères : la décision reste dans le journal.',
  valider: 'Forcer le statut',
  erreurServeur: 'Le statut n’a pas pu être forcé. Réessaie.',
  fermer: 'Fermer',
} as const

export const RAISON_FORCAGE_MIN = 10

export const OPTIONS_PERIODE: readonly { readonly valeur: Periode; readonly libelle: string }[] = [
  { valeur: '7j', libelle: '7 jours' },
  { valeur: '30j', libelle: '30 jours' },
  { valeur: 'tout', libelle: 'Tout' },
]

const nombre = (n: number, singulier: string, pluriel: string) =>
  `${String(n)} ${n < 2 ? singulier : pluriel}`

export const texteCarte = (blocs: number) =>
  `${nombre(blocs, 'bloc', 'blocs')} · les traits indiquent les prérequis`

export const texteAFaire = (aujourdhui: number, aVenir: number) =>
  `${String(aujourdhui)} à faire aujourd’hui · ${String(aVenir)} à venir`

export const texteErreur = (libelle: string, fois: number, codes: readonly string[]) =>
  `${libelle} · ${nombre(fois, 'fois', 'fois')} · ${codes.join(', ')}`

export const texteForce = (jour: string, bloc: string, statut: string) =>
  `${jour} · ${bloc} · ${statut} forcé`

export const texteSansPrerequis = (jour: string, bloc: string) => `${jour} · ${bloc}`

/** Les millionièmes d'euro en euros, à la française : 1,25 €. */
export function euros(millioniemes: number): string {
  return `${(millioniemes / 1_000_000).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export const texteBudget = (depense: number, plafond: number) =>
  `${euros(depense)} sur ${euros(plafond)} ce mois`
