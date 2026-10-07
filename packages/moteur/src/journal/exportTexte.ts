import type { Manifeste, Reglages, Statut } from '@janus/contrats'
import { echeances } from '../echeances.ts'
import type { Fait } from '../faits.ts'
import { calculerBloc } from '../statut.ts'
import { instantEnMs, jourDe } from '../temps.ts'

const LIBELLES_STATUT: Readonly<Record<Statut, string>> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  vu: 'Vu',
  acquis_provisoirement: 'Acquis provisoirement',
  acquis: 'Acquis',
  maitrise: 'Maîtrisé',
  a_reprendre: 'À reprendre',
}

const LIBELLES_ECHEANCE = {
  consolidation: 'consolidation',
  verification: 'vérification',
  retest: 'retest',
  entretien: 'entretien',
} as const

export interface ContexteExport {
  /** Les blocs du module dans l'ordre du plan. */
  readonly manifestes: readonly Manifeste[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  /** Les intitulés des tâches inédites réservées, dans l'ordre : aucun contenu. */
  readonly tachesReservees: readonly string[]
  /** Les idées de « À explorer plus tard », dans l'ordre où elles sont arrivées. */
  readonly idees: readonly string[]
  /** Le texte de la dernière revue de méthode, `null` s'il n'y en a pas. */
  readonly derniereRevue: string | null
}

/** Une cellule de tableau : une seule ligne, sans barre verticale qui casserait les colonnes. */
const cellule = (texte: string) =>
  texte
    .replace(/\s*\n\s*/g, ' ')
    .replaceAll('|', '/')
    .trim()
const ligneTableau = (cellules: readonly string[]) => `| ${cellules.map(cellule).join(' | ')} |`
const ou = (texte: string) => (texte === '' ? '-' : texte)

const ENTETE_TABLEAU = [
  'Date',
  'Bloc / tâche',
  'Statut',
  'Erreur précise',
  'Aide utilisée (0-4)',
  'Temps',
  'Prochaine vérification',
]

/**
 * Le journal au format de la méthode, en texte brut : l'en-tête (blocs dans l'ordre avec leurs
 * prérequis et erreurs critiques, tâches réservées, idées, dernière revue), puis le tableau des
 * séances, une ligne par bloc et par jour d'apprentissage. Une fonction pure : même entrée, même texte.
 */
export function exportTexte(contexte: ContexteExport): string {
  const { manifestes, faits, reglages } = contexte
  const sortie: string[] = ['## En-tête', '', "### Blocs dans l'ordre", '']
  if (manifestes.length === 0) sortie.push('Aucun bloc.')
  manifestes.forEach((manifeste, rang) => {
    const prerequis = manifeste.prerequis.length === 0 ? 'aucun' : manifeste.prerequis.join(', ')
    sortie.push(
      `${String(rang + 1)}. ${manifeste.bloc} ${manifeste.titre} (prérequis : ${prerequis})`,
    )
    for (const erreur of manifeste.erreurs_critiques) {
      sortie.push(`   - Erreur critique ${erreur.id} : ${erreur.libelle}`)
    }
  })
  sortie.push('', '### Tâches inédites réservées', '')
  if (contexte.tachesReservees.length === 0) sortie.push('Aucune.')
  for (const tache of contexte.tachesReservees) sortie.push(`- ${tache}`)
  sortie.push('', '### À explorer plus tard', '')
  if (contexte.idees.length === 0) sortie.push('Aucune idée.')
  for (const idee of contexte.idees) sortie.push(`- ${idee}`)
  sortie.push('', '### Dernière revue', '', contexte.derniereRevue ?? 'Aucune revue.')
  sortie.push(
    '',
    '## Séances',
    '',
    ligneTableau(ENTETE_TABLEAU),
    ligneTableau(ENTETE_TABLEAU.map(() => '---')),
  )

  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const lignes: { jour: string; rang: number; texte: string }[] = []
  manifestes.forEach((manifeste, rang) => {
    const faitsDuBloc = faits
      .filter((fait) => fait.bloc === manifeste.bloc)
      .sort((a, b) => instantEnMs(a.date) - instantEnMs(b.date))
    const jours = [...new Set(faitsDuBloc.map((fait) => jour(fait.date)))]
    for (const unJour of jours) {
      const duJour = faitsDuBloc.filter((fait) => jour(fait.date) === unJour)
      const jusqueLa = faitsDuBloc.filter((fait) => jour(fait.date) <= unJour)
      const dernier = duJour.reduce((_, fait) => fait.date, '')
      const resultat = calculerBloc(jusqueLa, manifeste, reglages, dernier)
      const erreurs = duJour.flatMap((fait) =>
        fait.type === 'erreur_cochee'
          ? [
              manifeste.erreurs_critiques.find(({ id }) => id === fait.erreur)?.libelle ??
                fait.erreur,
            ]
          : [],
      )
      const aides = duJour.flatMap((fait) =>
        fait.type === 'pratique_resultat' || fait.type === 'atelier_resultat' ? [fait.aide] : [],
      )
      const secondes = duJour.flatMap((fait) =>
        fait.type === 'aisance_resultat' ? [fait.dureeS] : [],
      )
      const prochaine = echeances(resultat, reglages)
      lignes.push({
        jour: unJour,
        rang,
        texte: ligneTableau([
          unJour,
          `${manifeste.bloc} ${manifeste.titre}`,
          LIBELLES_STATUT[resultat.statut],
          ou(erreurs.join(' ; ')),
          aides.length === 0 ? '-' : String(Math.max(...aides)),
          secondes.length === 0
            ? '-'
            : `${String(Math.round(secondes.reduce((a, b) => a + b, 0)))} s`,
          prochaine === null
            ? '-'
            : `${LIBELLES_ECHEANCE[prochaine.type]} ${prochaine.apres.slice(0, 10)}`,
        ]),
      })
    }
  })
  lignes.sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : a.rang - b.rang))
  for (const ligne of lignes) sortie.push(ligne.texte)
  return `${sortie.join('\n')}\n`
}
