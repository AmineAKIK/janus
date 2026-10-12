import type { Manifeste, Reglages, Tache, TacheDuJour } from '@janus/contrats'
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

/** Ce qui s'est fait dans la journée et que la file ne montre plus ou ne dit pas. */
export interface FaitsDuJour {
  /** Les questions de la série du jour qui ont reçu une réponse corrigée aujourd'hui. */
  readonly questionsRepondues: number
  /** Les cartes notées aujourd'hui. */
  readonly cartesRevues: number
}

/**
 * Les tâches de la journée : la file du moteur, chacune avec « faite aujourd'hui ». Les questions
 * de début de séance sont faites quand la série entière a reçu sa réponse. Une révision de cartes
 * terminée sort de la file (plus rien n'est dû) : elle y reste, faite, tant que des cartes ont été
 * notées dans la journée.
 */
export function tachesDuJour(
  taches: readonly Tache[],
  faits: FaitsDuJour,
  lien: (tache: Tache) => string,
): TacheDuJour[] {
  const terminees: Tache[] =
    faits.cartesRevues > 0 && !taches.some(({ type }) => type === 'cartes')
      ? [{ type: 'cartes', dues: 0, nouvelles: 0 }]
      : []
  const rangDuBloc = taches.findIndex(({ type }) => type === 'bloc')
  const toutes =
    rangDuBloc < 0
      ? [...taches, ...terminees]
      : [...taches.slice(0, rangDuBloc), ...terminees, ...taches.slice(rangDuBloc)]
  return toutes.map((tache) => ({
    tache,
    lien: lien(tache),
    faite:
      (tache.type === 'questions_debut' && faits.questionsRepondues >= tache.nombre) ||
      (tache.type === 'cartes' && tache.dues + tache.nouvelles === 0),
  }))
}
