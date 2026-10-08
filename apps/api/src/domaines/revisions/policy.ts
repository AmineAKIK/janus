import { Manifeste } from '@janus/contrats'
import type { Fait, Reglages, Statut } from '@janus/contrats'
import { blocEnCours, calculerBloc, choisirQuestionsDebut, jourDe } from '@janus/moteur'
import type { BlocDeLaFile, QuestionDebut } from '@janus/moteur'

/** Les statuts à partir desquels un bloc compte comme « vu » pour les questions et les cartes. */
const AU_MOINS_VU: ReadonlySet<Statut> = new Set([
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])

/** Un bloc importé du plan, avec son manifeste en service. */
export interface BlocDuPlan {
  readonly id: string
  readonly code: string
  readonly moduleId: string
  readonly manifeste: unknown
}

/** Ce que les routes de la séance du jour partagent : les blocs calculés, ceux qui sont vus, le bloc en cours. */
export interface ContexteDuJour {
  readonly blocs: readonly (BlocDeLaFile & { readonly moduleId: string })[]
  readonly vus: readonly BlocDeLaFile[]
  readonly derniereActivite: string | null
  readonly enCours: string | null
  readonly jour: string
}

/** Calcule chaque bloc du plan depuis ses faits, puis ce qui s'en déduit : vus, bloc en cours, dernière activité. */
export function contexteDuJour(
  plan: readonly BlocDuPlan[],
  faits: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): ContexteDuJour {
  const blocs = plan.map(({ code, moduleId, manifeste }) => {
    const lu = Manifeste.parse(manifeste)
    const duBloc = faits.filter((fait) => fait.bloc === code)
    return {
      manifeste: lu,
      moduleId,
      etat: calculerBloc(duBloc, lu, reglages, maintenant),
      dernierFait: duBloc.reduce<string | null>(
        (dernier, fait) => (dernier === null || fait.date > dernier ? fait.date : dernier),
        null,
      ),
    }
  })
  const derniereActivite = blocs.reduce<string | null>(
    (dernier, { dernierFait }) =>
      dernierFait !== null && (dernier === null || dernierFait > dernier) ? dernierFait : dernier,
    null,
  )
  const enCours = blocEnCours(
    blocs.map(({ manifeste, etat, dernierFait }) => ({
      bloc: manifeste.bloc,
      statut: etat.statut,
      dernierFait,
    })),
  )
  return {
    blocs,
    vus: blocs.filter(({ etat }) => AU_MOINS_VU.has(etat.statut)),
    derniereActivite,
    enCours,
    jour: jourDe(maintenant, reglages.fuseau, reglages.heureBascule),
  }
}

/** Les questions de début de séance du jour, tirées dans les blocs vus (graine : le jour). */
export function tirerQuestionsDuJour(
  contexte: ContexteDuJour,
  faits: readonly Fait[],
  reglages: Reglages,
): QuestionDebut[] {
  const prerequisDuBlocEnCours =
    contexte.blocs.find(({ manifeste }) => manifeste.bloc === contexte.enCours)?.manifeste
      .prerequis ?? []
  return choisirQuestionsDebut(
    contexte.vus.map(({ manifeste }) => ({
      manifeste,
      prerequisDuBlocEnCours: prerequisDuBlocEnCours.includes(manifeste.bloc),
    })),
    faits,
    reglages,
    Date.parse(contexte.jour),
  )
}
