import type { Manifeste, Reglages, Tache } from '@janus/contrats'
import { blocEnCours } from './definitions.ts'
import { echeances, estDue } from './echeances.ts'
import type { ResultatBloc } from './statut.ts'
import { ecartEnJours, jourDe } from './temps.ts'

/** Au bout de ce nombre de jours sans activité, ou au-delà de ce nombre de cartes dues, Amine est en retard. */
export const JOURS_AVANT_RETARD = 7
export const CARTES_AVANT_RETARD = 50

/** Un bloc du plan avec son état calculé ; `dernierFait` est la date de son dernier fait. */
export interface BlocDeLaFile {
  readonly manifeste: Manifeste
  readonly etat: ResultatBloc
  readonly dernierFait: string | null
}

export interface EntreeFile {
  /** Les blocs dans l'ordre du plan. */
  readonly blocs: readonly BlocDeLaFile[]
  /** Nombre de questions de début de séance choisies (0 s'il n'y en a pas). */
  readonly questionsDebut: number
  /** Les identifiants des cartes à faire (voir `cartesDuJour`). */
  readonly cartes: { readonly dues: readonly string[]; readonly nouvelles: readonly string[] }
  readonly derniereActivite: string | null
  readonly maintenant: string
  readonly reglages: Reglages
}

export type { Tache }

/** Vrai si la dernière activité date de 7 jours ou plus (en jours de `jourDe`), ou si plus de 50 cartes sont dues. */
export function enRetard(
  derniereActivite: string | null,
  cartesDues: number,
  maintenant: string,
  reglages: Reglages,
): boolean {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const inactif =
    derniereActivite !== null &&
    ecartEnJours(jour(derniereActivite), jour(maintenant)) >= JOURS_AVANT_RETARD
  return inactif || cartesDues > CARTES_AVANT_RETARD
}

/**
 * La file de l'écran Aujourd'hui, toujours dans le même ordre : 1. erreurs critiques à reprendre ;
 * 2. questions de début de séance ; 3. vérifications et retests dus, d'abord ceux des prérequis du bloc
 * en cours (en retard, précédés de la reprise de ces prérequis) ; 4. série de consolidation en attente ;
 * 5. cartes ; 6. le bloc en cours ou le suivant. Le nouveau contenu passe toujours après le retard.
 */
export function fileDuJour(entree: EntreeFile): { enRetard: boolean; taches: Tache[] } {
  const { blocs, maintenant, reglages } = entree
  const retard = enRetard(entree.derniereActivite, entree.cartes.dues.length, maintenant, reglages)
  const enCours = blocEnCours(
    blocs.map(({ manifeste, etat, dernierFait }) => ({
      bloc: manifeste.bloc,
      statut: etat.statut,
      dernierFait,
    })),
  )
  const prerequis =
    blocs.find(({ manifeste }) => manifeste.bloc === enCours)?.manifeste.prerequis ?? []

  const erreurs = blocs.flatMap(({ manifeste, etat }) =>
    etat.erreursOuvertes.map((erreur): Tache => {
      const critique = manifeste.erreurs_critiques.find(({ id }) => id === erreur)
      const base = `/blocs/${manifeste.bloc}`
      return {
        type: 'reprendre_erreur',
        bloc: manifeste.bloc,
        erreur,
        libelle: critique?.libelle ?? erreur,
        lien: critique?.etape === undefined ? base : `${base}?etape=${critique.etape}`,
      }
    }),
  )

  const dues = blocs.flatMap(({ manifeste, etat }) => {
    const echeance = echeances(etat, reglages)
    return echeance !== null && estDue(echeance, maintenant, reglages)
      ? [{ bloc: manifeste.bloc, echeance }]
      : []
  })
  const prioritaire = (bloc: string) => (prerequis.includes(bloc) ? 0 : 1)
  const revisions = dues
    .flatMap(({ bloc, echeance }) =>
      echeance.type === 'consolidation'
        ? []
        : [
            {
              rang: prioritaire(bloc),
              tache: { type: echeance.type, bloc, apres: echeance.apres },
            },
          ],
    )
    .sort((a, b) => a.rang - b.rang)
    .map(({ tache }): Tache => tache)
  const consolidations = dues.flatMap(({ bloc, echeance }): Tache[] =>
    echeance.type === 'consolidation'
      ? [{ type: 'consolidation', bloc, apres: echeance.apres }]
      : [],
  )

  const aReprendre = blocs
    .filter(
      ({ manifeste, etat }) => prerequis.includes(manifeste.bloc) && etat.statut !== 'non_commence',
    )
    .map(({ manifeste }) => manifeste.bloc)
  const cartes = entree.cartes.dues.length + entree.cartes.nouvelles.length

  return {
    enRetard: retard,
    taches: [
      ...erreurs,
      ...(entree.questionsDebut > 0
        ? [{ type: 'questions_debut', nombre: entree.questionsDebut } satisfies Tache]
        : []),
      ...(retard && aReprendre.length > 0
        ? [{ type: 'reprise', blocs: aReprendre } satisfies Tache]
        : []),
      ...revisions,
      ...consolidations,
      ...(cartes > 0
        ? [
            {
              type: 'cartes',
              dues: entree.cartes.dues.length,
              nouvelles: entree.cartes.nouvelles.length,
            } satisfies Tache,
          ]
        : []),
      ...(enCours === null ? [] : [{ type: 'bloc', bloc: enCours } satisfies Tache]),
    ],
  }
}
