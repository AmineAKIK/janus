import { ROUTES } from '@janus/contrats'
import type {
  EtatDemo,
  Manifeste,
  Statut,
  Tache,
  TacheDuJour,
  TypeVerification,
} from '@janus/contrats'
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
import type { Magasin } from '../store.ts'
import type { HorlogeDemo } from '../horlogeDemo.ts'
import { definir } from './definir.ts'
import { blocsReportes, verificationPour } from './verifications.ts'

/** Les statuts à partir desquels un bloc compte comme « vu » pour les questions et les cartes. */
const AU_MOINS_VU: ReadonlySet<Statut> = new Set([
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])

/** Où mène une tâche : les écrans de séance des PR suivantes, ou le bloc. */
function lienDeLaTache(
  tache: Tache,
  verification: (bloc: string, type: TypeVerification) => string,
): string {
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
      return `/verifications/${verification(tache.bloc, tache.type)}`
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

/** Ce que les routes du jour partagent : les blocs, ceux qui sont vus, et les questions de la journée. */
export function contexteDuJour(etat: EtatDemo, maintenant: string) {
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
  return { blocs, derniereActivite, enCours, vus, questions, jourDu, reglages }
}

/** La série du jour : tirée à la première lecture puis gardée, pour qu'elle ne bouge pas après une réponse. */
export function serieDuJour(magasin: Magasin, maintenant: string) {
  const etat = magasin.lire()
  const { questions, jourDu } = contexteDuJour(etat, maintenant)
  const jour = jourDu(maintenant)
  if (etat.serieDuJour?.jour === jour) return { jour, questions: etat.serieDuJour.questions }
  const tirees = questions.map(({ bloc, question }) => ({ bloc, question }))
  magasin.ecrire((avant) => ({ ...avant, serieDuJour: { jour, questions: tirees } }))
  return { jour, questions: tirees }
}

/** Les cartes à réviser aujourd'hui : les dues, puis les nouvelles dans la limite du réglage. */
export function cartesDuJourDemo(etat: EtatDemo, maintenant: string) {
  const { vus, reglages, jourDu } = contexteDuJour(etat, maintenant)
  const jour = jourDu(maintenant)
  const introduitesAujourdhui = Object.values(etat.cartes).filter(
    (carte) =>
      carte.repetitions === 1 &&
      carte.derniereRevision !== null &&
      jourDu(carte.derniereRevision) === jour,
  ).length
  return cartesDuJour({
    cartes: vus.flatMap(({ manifeste }) =>
      manifeste.cartes.map(({ id }) => ({
        id: `${manifeste.bloc}:${id}`,
        bloc: manifeste.bloc,
        etat: etat.cartes[`${manifeste.bloc}:${id}`] ?? null,
      })),
    ),
    blocsVus: vus.map(({ manifeste }) => manifeste.bloc),
    nouvellesDejaIntroduites: introduitesAujourdhui,
    maintenant,
    reglages,
  })
}

/** La réponse de `GET /aujourdhui` : la file du jour, assez pour que le tableau de bord la reprenne telle quelle. */
export function aujourdhuiDemo(magasin: Magasin, horloge: HorlogeDemo) {
  const etat = magasin.lire()
  const maintenant = horloge.maintenant()
  const { blocs, derniereActivite, questions, jourDu, reglages } = contexteDuJour(etat, maintenant)
  const cartes = cartesDuJourDemo(etat, maintenant)

  const file = fileDuJour({
    blocs,
    questionsDebut: questions.length,
    cartes,
    derniereActivite,
    maintenant,
    reglages,
  })
  const jour = jourDu(maintenant)
  const joursDePause = derniereActivite === null ? 0 : ecartEnJours(jourDu(derniereActivite), jour)
  const toutFait = etat.interrupteurs.toutFait
  const reportes = blocsReportes(etat, jour)
  const module = catalogueGraine().modules.find(({ code }) => code === 'M1')

  return {
    jour,
    en_retard: file.enRetard,
    ...(joursDePause >= JOURS_AVANT_RETARD ? { retour: { jours: joursDePause } } : {}),
    premiere_connexion: etat.faits.length === 0,
    taches: file.taches
      .filter(
        (tache) =>
          !(
            (tache.type === 'verification' ||
              tache.type === 'retest' ||
              tache.type === 'entretien') &&
            reportes.has(tache.bloc)
          ),
      )
      .map((tache): TacheDuJour => ({
        tache,
        lien: lienDeLaTache(
          tache,
          (bloc, type) => verificationPour(magasin, bloc, type, maintenant) ?? bloc,
        ),
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
}

export const ROUTES_AUJOURDHUI_DEMO = [
  definir(ROUTES['GET /aujourdhui'], ({ magasin, horloge }) => aujourdhuiDemo(magasin, horloge)),
]
