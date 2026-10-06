import type { Reglages } from '@janus/contrats'

export const TEXTES_PARAMETRES = {
  titre: 'Paramètres',
  introduction:
    'Les préférences règlent ton confort, jamais les règles de preuve. Les délais et seuils méthodologiques restent en lecture seule.',
  sommaire: 'Sur cette page',
  choisir: 'Choisis une section',
  retour: 'Paramètres',
  parDefaut: (valeur: string) => `Par défaut : ${valeur}`,
  revenir: 'Revenir à la valeur par défaut',
  conflit: 'Ces réglages ont changé sur un autre appareil.',
  erreurEnregistrement: 'Le réglage n’a pas été enregistré. Réessaie.',
  pied: (nom: string) => `${nom} ne vend pas tes données.`,
  chargement: 'Chargement…',
  erreur: 'Les paramètres ne se sont pas chargés.',
  reessayer: 'Réessayer',
} as const

export const TEXTES_REVISION = {
  nouvellesCartes: 'Nouvelles cartes par jour',
  nouvellesCartesAide: 'Le plafond touche seulement les nouvelles cartes.',
  retention: 'Rétention visée',
  retentionAide: 'La part des cartes que tu veux encore savoir au moment de les revoir.',
  questionsDebut: 'Questions de début de séance',
  questionsDebutAide: 'Entre 5 et 10 questions.',
} as const

export const TEXTES_REGLES = {
  badge: 'Règle protégée',
  explication: 'Les délais méthodologiques restent en lecture seule pour préserver la preuve.',
} as const

export const TEXTES_AFFICHAGE = {
  apparence: 'Apparence',
  taille: 'Taille du texte',
} as const

/** Un nombre à la française, avec le nombre de décimales voulu : 0,90. */
export const nombreFrancais = (valeur: number, decimales = 0) =>
  valeur.toFixed(decimales).replace('.', ',')

export function texteDuree(minutes: number): string {
  if (minutes % 1440 === 0) return `${String(minutes / 1440)} j`
  if (minutes % 60 === 0) return `${String(minutes / 60)} h`
  return `${String(minutes)} min`
}

const nomsNombres = new Map([
  [1, 'Un'],
  [2, 'Deux'],
  [3, 'Trois'],
  [4, 'Quatre'],
  [5, 'Cinq'],
])

export function texteEchecs(echecs: number): string {
  const nombre = nomsNombres.get(echecs) ?? String(echecs)
  return `${nombre} échec${echecs > 1 ? 's' : ''} pour descendre`
}

export function texteEntretien(mois: readonly number[]): string {
  const liste = mois.map(String)
  const dernier = liste.pop()
  if (dernier === undefined) return 'Aucun'
  return `${liste.length > 0 ? `${liste.join(', ')} et ` : ''}${dernier} mois`
}

export interface LigneRegle {
  readonly libelle: string
  readonly valeur: string
}

export function lignesRegles(reglages: Reglages): readonly LigneRegle[] {
  return [
    { libelle: 'Consolidation', valeur: texteDuree(reglages.delaiConsolidationMinutes) },
    { libelle: 'Vérification', valeur: `${String(reglages.delaiVerificationJours)} j` },
    { libelle: 'Retest', valeur: `${String(reglages.delaiRetestJours)} j` },
    { libelle: 'Entretien', valeur: texteEntretien(reglages.entretienMois) },
    { libelle: 'Nouvelle tentative', valeur: `${String(reglages.delaiNouvelEssaiJours)} j` },
    { libelle: 'Échecs avant descente', valeur: texteEchecs(reglages.echecsAvantDescente) },
    {
      libelle: 'Seuil de consolidation',
      valeur: `${String(Math.round(reglages.seuilConsolidation * 100))} %`,
    },
    { libelle: 'Revue', valeur: `Tous les ${String(reglages.blocsEntreRevues)} blocs` },
  ]
}
