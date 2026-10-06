import { ROUTES } from '@janus/contrats'
import {
  blocsOuvertsSansPrerequis,
  carteDuModule,
  depenseDuMois,
  ecartEnJours,
  echeances,
  erreursRecurrentes,
  ouverturesSansPrerequis,
  statutsForces,
} from '@janus/moteur'
import type { Periode } from '@janus/moteur'
import { catalogueGraine, MANIFESTES_GRAINE } from '../graine.ts'
import { aujourdhuiDemo } from './aujourdhui.ts'
import { resultatDuBloc } from './calculs.ts'
import { definir } from './definir.ts'

/** Ce que coûte une correction de l'IA dans la démo : un prix de démonstration, pas une règle du cadrage. */
export const COUT_CORRECTION_DEMO_MILLIONIEMES = 5_000

const JOURS_A_VENIR = 7
const PERIODE_PAR_DEFAUT: Periode = '30j'

export const ROUTES_TABLEAU_DE_BORD_DEMO = [
  definir(ROUTES['GET /tableau-de-bord'], ({ magasin, horloge, requete }) => {
    const etat = magasin.lire()
    const { reglages, faits } = etat
    const maintenant = horloge.maintenant()
    const periode = requete.periode ?? PERIODE_PAR_DEFAUT
    const importes = catalogueGraine().modules.flatMap((candidat) =>
      candidat.importe ? [candidat] : [],
    )
    const module =
      importes.find(({ code }) => code === requete.module) ??
      (requete.module === undefined ? importes[0] : undefined)

    const sansPrerequis = blocsOuvertsSansPrerequis(faits)
    const blocs = (module?.parties ?? []).flatMap((partie) =>
      partie.blocs.flatMap((code) => {
        const manifeste = MANIFESTES_GRAINE[code]
        return manifeste === undefined
          ? []
          : [
              {
                manifeste,
                partie: `${partie.code} ${partie.titre}`,
                resultat: resultatDuBloc(etat, code, maintenant),
              },
            ]
      }),
    )
    const carte = carteDuModule(
      blocs.map(({ manifeste, partie, resultat }) => ({
        bloc: manifeste.bloc,
        partie,
        prerequis: manifeste.prerequis,
        statut: resultat.statut,
        force: resultat.force !== null,
        descendu: resultat.descendu,
      })),
      sansPrerequis,
    )

    const jour = aujourdhuiDemo(magasin, horloge)
    const restantes = jour.taches.filter(({ faite }) => !faite)
    const aVenir = blocs.filter(({ resultat }) => {
      const echeance = echeances(resultat, reglages)
      if (echeance?.genre !== 'jour') return false
      const ecart = ecartEnJours(jour.jour, echeance.apres)
      return ecart >= 1 && ecart <= JOURS_A_VENIR
    }).length

    const libelles = new Map(
      blocs.flatMap(({ manifeste }) =>
        manifeste.erreurs_critiques.map(({ id, libelle }): [string, string] => [id, libelle]),
      ),
    )
    const ouvertes = new Set(blocs.flatMap(({ resultat }) => resultat.erreursOuvertes))

    const plafond = reglages.plafondIaMillioniemes
    const couts = faits.flatMap((fait) =>
      fait.type === 'correction'
        ? [{ date: fait.date, millioniemes: COUT_CORRECTION_DEMO_MILLIONIEMES }]
        : [],
    )
    const depense = etat.interrupteurs.plafondAtteint
      ? plafond
      : Math.min(plafond, depenseDuMois(couts, maintenant, reglages))

    return {
      modules: importes.map(({ code, titre }) => ({ id: code, titre })),
      module: module === undefined ? null : { id: module.code, titre: module.titre },
      periode,
      blocs: carte.map(
        ({ bloc, partie, statut, prerequis, force, redescendu, prerequisNonValides }) => ({
          bloc,
          titre_court: MANIFESTES_GRAINE[bloc]?.titre_court ?? bloc,
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
      cout_ia: { depense_millioniemes: depense, plafond_millioniemes: plafond },
    }
  }),
]
