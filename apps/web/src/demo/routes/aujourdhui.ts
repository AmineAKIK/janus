import { ROUTES } from '@janus/contrats'
import type { Manifeste, Statut, Tache, TacheDuJour } from '@janus/contrats'
import {
  blocEnCours,
  cartesDuJour,
  choisirQuestionsDebut,
  ecartEnJours,
  fileDuJour,
  JOURS_AVANT_RETARD,
  jourDe,
} from '@janus/moteur'
import { catalogueGraine, MANIFESTES_GRAINE, PLAN } from '../graine.ts'
import { faitsDuBloc, resultatDuBloc } from './calculs.ts'
import { definir } from './definir.ts'

/** Les statuts à partir desquels un bloc compte comme « vu » pour les questions et les cartes. */
const AU_MOINS_VU: ReadonlySet<Statut> = new Set([
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])

/** Où mène une tâche : les écrans de séance des PR suivantes, ou le bloc. */
function lienDeLaTache(tache: Tache): string {
  switch (tache.type) {
    case 'reprendre_erreur':
      return tache.lien
    case 'questions_debut':
      return '/questions'
    case 'reprise':
      return `/blocs/${tache.blocs[0] ?? ''}`
    case 'verification':
    case 'retest':
    case 'entretien':
      return `/verifications/${tache.bloc}`
    case 'consolidation': {
      const etape = MANIFESTES_GRAINE[tache.bloc]?.etapes.find(
        ({ type }) => type === 'consolidation',
      )
      return etape === undefined ? `/blocs/${tache.bloc}` : `/blocs/${tache.bloc}?etape=${etape.id}`
    }
    case 'cartes':
      return '/revision'
    case 'bloc':
      return `/blocs/${tache.bloc}`
  }
}

export const ROUTES_AUJOURDHUI_DEMO = [
  definir(ROUTES['GET /aujourdhui'], ({ magasin, horloge }) => {
    const etat = magasin.lire()
    const maintenant = horloge.maintenant()
    const { reglages } = etat
    const jourDu = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)

    const blocs = PLAN.flatMap(({ code }) => {
      const manifeste = MANIFESTES_GRAINE[code]
      if (manifeste === undefined) return []
      const faits = faitsDuBloc(etat, code)
      return [
        {
          manifeste,
          etat: resultatDuBloc(etat, code, maintenant),
          dernierFait: faits.reduce<string | null>(
            (dernier, fait) => (dernier === null || fait.date > dernier ? fait.date : dernier),
            null,
          ),
        },
      ]
    })
    const derniereActivite = blocs.reduce<string | null>(
      (dernier, { dernierFait }) =>
        dernierFait !== null && (dernier === null || dernierFait > dernier) ? dernierFait : dernier,
      null,
    )

    const enCours = blocEnCours(
      blocs.map(({ manifeste, etat: resultat, dernierFait }) => ({
        bloc: manifeste.bloc,
        statut: resultat.statut,
        dernierFait,
      })),
    )
    const vus = blocs.filter(({ etat: resultat }) => AU_MOINS_VU.has(resultat.statut))
    const questions = choisirQuestionsDebut(
      vus.map(({ manifeste }) => ({
        manifeste,
        prerequisDuBlocEnCours: (
          blocs.find(({ manifeste: autre }) => autre.bloc === enCours)?.manifeste.prerequis ?? []
        ).includes(manifeste.bloc),
      })),
      etat.faits,
      reglages,
      Date.parse(jourDu(maintenant)),
    )
    const cartes = cartesDuJour({
      cartes: vus.flatMap(({ manifeste }) =>
        manifeste.cartes.map(({ id }) => ({
          id: `${manifeste.bloc}:${id}`,
          bloc: manifeste.bloc,
          etat: null,
        })),
      ),
      blocsVus: vus.map(({ manifeste }) => manifeste.bloc),
      nouvellesDejaIntroduites: 0,
      maintenant,
      reglages,
    })

    const file = fileDuJour({
      blocs,
      questionsDebut: questions.length,
      cartes,
      derniereActivite,
      maintenant,
      reglages,
    })
    const jour = jourDu(maintenant)
    const joursDePause =
      derniereActivite === null ? 0 : ecartEnJours(jourDu(derniereActivite), jour)
    const toutFait = etat.interrupteurs.toutFait
    const module = catalogueGraine().modules.find(({ code }) => code === 'M1')

    return {
      jour,
      en_retard: file.enRetard,
      ...(joursDePause >= JOURS_AVANT_RETARD ? { retour: { jours: joursDePause } } : {}),
      premiere_connexion: etat.faits.length === 0,
      taches: file.taches.map((tache): TacheDuJour => ({
        tache,
        lien: lienDeLaTache(tache),
        faite: toutFait,
      })),
      module:
        module === undefined
          ? null
          : {
              id: module.code,
              titre: module.titre,
              blocs: blocs.map(
                ({
                  manifeste,
                  etat: resultat,
                }: {
                  manifeste: Manifeste
                  etat: { statut: Statut }
                }) => ({
                  bloc: manifeste.bloc,
                  titre_court: manifeste.titre_court,
                  statut: resultat.statut,
                }),
              ),
            },
    }
  }),
]
