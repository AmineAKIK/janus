import type { Fait, NoteCarte, Reglages, TacheDuJour } from '@janus/contrats'
import { faitsParBloc } from '../parBloc.ts'
import { calculerBloc } from '../statut.ts'
import { ecartEnJours } from '../temps.ts'
import { echeances } from '../echeances.ts'
import {
  aisanceDesBlocs,
  autonomie,
  blocsOuvertsSansPrerequis,
  calibration,
  carteDuModule,
  depenseDuMois,
  erreursRecurrentes,
  fiabilite,
  ouverturesSansPrerequis,
  retention,
  revueMethode,
  statutsForces,
  tempsActif,
} from '../indicateurs/index.ts'
import type { ControleCorrection, MesureTemps, Periode } from '../indicateurs/index.ts'
import type { BlocImporte } from './bloc.ts'

export const PERIODE_PAR_DEFAUT: Periode = '30j'
const JOURS_A_VENIR = 7

export interface EntreeTableau {
  readonly modules: readonly { readonly id: string; readonly titre: string }[]
  readonly module: string | undefined
  readonly periode: Periode | undefined
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly maintenant: string
  readonly controles: readonly ControleCorrection[]
  readonly revuesCartes: readonly { readonly date: string; readonly note: NoteCarte }[]
  readonly mesuresTemps: readonly MesureTemps[]
  readonly derniereRevue: string | null
  readonly couts: readonly { readonly date: string; readonly millioniemes: number }[]
  readonly aujourdhui: { readonly jour: string; readonly taches: readonly TacheDuJour[] }
}

/** Le tableau de bord, calculé à la lecture avec les fonctions du moteur. */
export function composerTableau(entree: EntreeTableau) {
  const { faits, reglages, maintenant, aujourdhui } = entree
  const periode = entree.periode ?? PERIODE_PAR_DEFAUT
  const module =
    entree.modules.find(({ id }) => id === entree.module) ??
    (entree.module === undefined ? entree.modules[0] : undefined)

  const duBloc = faitsParBloc(faits)
  const blocs = entree.blocs
    .filter(({ moduleCode }) => moduleCode === module?.id)
    .map(({ code, partie, manifeste }) => ({
      manifeste,
      partie,
      resultat: calculerBloc(duBloc.get(code) ?? [], manifeste, reglages, maintenant),
    }))
  const carte = carteDuModule(
    blocs.map(({ manifeste, partie, resultat }) => ({
      bloc: manifeste.bloc,
      partie,
      prerequis: manifeste.prerequis,
      statut: resultat.statut,
      force: resultat.force !== null,
      descendu: resultat.descendu,
    })),
    blocsOuvertsSansPrerequis(faits),
  )

  const restantes = aujourdhui.taches.filter(({ faite }) => !faite)
  const aVenir = blocs.filter(({ resultat }) => {
    const echeance = echeances(resultat, reglages)
    if (echeance?.genre !== 'jour') return false
    const ecart = ecartEnJours(aujourdhui.jour, echeance.apres)
    return ecart >= 1 && ecart <= JOURS_A_VENIR
  }).length

  const libelles = new Map(
    blocs.flatMap(({ manifeste }) =>
      manifeste.erreurs_critiques.map(({ id, libelle }): [string, string] => [id, libelle]),
    ),
  )
  const ouvertes = new Set(blocs.flatMap(({ resultat }) => resultat.erreursOuvertes))

  const plafond = reglages.plafondIaMillioniemes
  const depense = Math.min(plafond, depenseDuMois(entree.couts, maintenant, reglages))
  const mesureAutonomie = autonomie(faits, maintenant, reglages)
  const semainesRetention = retention(faits, entree.revuesCartes, maintenant, reglages)
  const controle = fiabilite(entree.controles, faits, periode, maintenant, reglages)
  const revue = revueMethode(
    faits,
    entree.mesuresTemps,
    entree.blocs.map(({ manifeste }) => manifeste),
    entree.derniereRevue,
    reglages,
  )
  const temps = tempsActif(entree.mesuresTemps, maintenant, reglages)
  const calibre = calibration(faits, periode, maintenant, reglages)
  const aisance = aisanceDesBlocs(
    blocs.map(({ manifeste }) => manifeste),
    faits,
    reglages,
  )
  const titreCourt = (bloc: string) =>
    blocs.find(({ manifeste }) => manifeste.bloc === bloc)?.manifeste.titre_court ?? bloc

  return {
    modules: entree.modules.map(({ id, titre }) => ({ id, titre })),
    module: module === undefined ? null : { id: module.id, titre: module.titre },
    periode,
    blocs: carte.map(
      ({ bloc, partie, statut, prerequis, force, redescendu, prerequisNonValides }) => ({
        bloc,
        titre_court: titreCourt(bloc),
        partie,
        statut,
        prerequis: [...prerequis],
        force,
        redescendu,
        prerequis_non_valides: prerequisNonValides,
      }),
    ),
    a_faire: {
      aujourdhui: restantes.length,
      a_venir: aVenir,
      taches: restantes.slice(0, 3),
    },
    erreurs: erreursRecurrentes(faits, libelles, ouvertes, periode, maintenant, reglages).map(
      ({ blocs: codes, ...erreur }) => ({ ...erreur, blocs: [...codes] }),
    ),
    decisions: {
      forces: statutsForces(faits, periode, maintenant, reglages),
      sans_prerequis: ouverturesSansPrerequis(faits, periode, maintenant, reglages),
    },
    mesures: {
      autonomie: {
        semaines: mesureAutonomie.semaines.map(({ debut, sansAide, total, part }) => ({
          debut,
          sans_aide: sansAide,
          total,
          part,
        })),
        aide_moyenne: mesureAutonomie.aideMoyenne,
      },
      retention: semainesRetention.map((semaine) => ({
        debut: semaine.debut,
        cartes: { ...semaine.cartes },
        questions: { ...semaine.questions },
        verifications: { ...semaine.verifications },
      })),
      calibration: {
        lignes: calibre.lignes.map((ligne) => ({ ...ligne })),
        erreurs_sures: calibre.erreursSuresCetteSemaine.map((erreur) => ({ ...erreur })),
      },
      aisance: aisance.map(({ bloc, titre, cible }) => ({
        bloc,
        titre_court: titre,
        cible:
          cible === null
            ? null
            : {
                libelle: cible.libelle,
                paliers_s: [...cible.paliersS],
                meilleur_s: cible.meilleurS,
                paliers_reussis: cible.paliersReussis,
              },
      })),
      revue: {
        a_proposer: revue.aProposer,
        blocs_depuis: revue.blocsDepuis,
        blocs_requis: revue.blocsRequis,
        temps_s: revue.tempsS,
        pratique_s: revue.pratiqueS,
        a_reprendre: revue.aReprendre.map((notion) => ({ ...notion })),
        etapes_sautees: revue.etapesSautees.map((etape) => ({ ...etape })),
      },
      fiabilite: {
        copies_relues: controle.copiesRelues,
        desaccords: controle.desaccords,
        non_verifiees: controle.nonVerifiees,
        contestations: controle.contestations,
        alerte: controle.alerte,
      },
      temps: {
        total_s: temps.totalS,
        lecture_s: temps.groupes.lecture,
        pratique_s: temps.groupes.pratique,
        restitution_s: temps.groupes.restitution,
        blocs: temps.blocs.map(({ bloc, secondes }) => ({
          bloc,
          titre_court: titreCourt(bloc),
          secondes,
        })),
      },
    },
    cout_ia: { depense_millioniemes: depense, plafond_millioniemes: plafond },
  }
}
