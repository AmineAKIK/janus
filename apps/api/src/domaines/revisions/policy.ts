import { InstantUtc, Manifeste } from '@janus/contrats'
import type { Fait, NoteCarte, Reglages, Statut } from '@janus/contrats'
import {
  apercuCarte,
  blocEnCours,
  calculerBloc,
  carteNeuve,
  cartesDuJour,
  choisirQuestionsDebut,
  jourDe,
  noterCarte,
} from '@janus/moteur'
import type { ApercuCarte, BlocDeLaFile, EtatCarte, QuestionDebut } from '@janus/moteur'
import { z } from 'zod'

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
  readonly moduleCode: string
  readonly moduleTitre: string
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

/** L'état d'une carte tel qu'il est gardé : celui de FSRS, plus ce qu'il faut pour le jour et le rejeu. */
export const EtatGarde = z.strictObject({
  echeance: InstantUtc,
  stabilite: z.number(),
  difficulte: z.number(),
  joursProgrammes: z.number(),
  etapeApprentissage: z.number(),
  repetitions: z.number(),
  oublis: z.number(),
  phase: z.enum(['nouvelle', 'apprentissage', 'revision', 'reapprentissage']),
  derniereRevision: InstantUtc.nullable(),
  /** Le jour de la première note : les nouvelles cartes du jour se comptent là-dessus. */
  introduiteLe: InstantUtc,
  /** La dernière note reçue : la rejouer ne change rien. */
  noteId: z.string(),
})
export type EtatGarde = z.infer<typeof EtatGarde>

/** Une carte du catalogue, identifiée pour l'API par `<bloc>:<carte>`. */
export interface CarteDuCatalogue {
  readonly bloc: string
  readonly carte: string
  readonly recto: string
  readonly verso: string
}

export function idDeLaCarte({ bloc, carte }: Pick<CarteDuCatalogue, 'bloc' | 'carte'>): string {
  return `${bloc}:${carte}`
}

/** Ce que la page reçoit pour une carte. */
export interface CarteRendue {
  readonly id: string
  readonly bloc: string
  readonly recto: string
  readonly verso: string
  readonly nouvelle: boolean
  readonly apercu: ApercuCarte
}

export interface CartesDuJour {
  readonly dues: readonly CarteRendue[]
  readonly nouvelles: readonly CarteRendue[]
  readonly prochaine: string | null
}

/** Les cartes dues et les nouvelles des blocs vus, avec l'aperçu de chaque note. */
export function cartesAFaire(
  catalogue: readonly CarteDuCatalogue[],
  etats: ReadonlyMap<string, EtatGarde>,
  contexte: ContexteDuJour,
  reglages: Reglages,
  maintenant: string,
): CartesDuJour {
  const introduitesAujourdhui = [...etats.values()].filter(
    ({ introduiteLe }) =>
      jourDe(introduiteLe, reglages.fuseau, reglages.heureBascule) === contexte.jour,
  ).length
  const choix = cartesDuJour({
    cartes: catalogue.map((carte) => ({
      id: idDeLaCarte(carte),
      bloc: carte.bloc,
      etat: etats.get(idDeLaCarte(carte)) ?? null,
    })),
    blocsVus: contexte.vus.map(({ manifeste }) => manifeste.bloc),
    nouvellesDejaIntroduites: introduitesAujourdhui,
    maintenant,
    reglages,
  })
  const rendre = (id: string, nouvelle: boolean): CarteRendue[] => {
    const carte = catalogue.find((autre) => idDeLaCarte(autre) === id)
    if (carte === undefined) return []
    return [
      {
        id,
        bloc: carte.bloc,
        recto: carte.recto,
        verso: carte.verso,
        nouvelle,
        apercu: apercuCarte(etats.get(id) ?? null, maintenant, reglages),
      },
    ]
  }
  const prochaines = [...etats.values()]
    .map(({ echeance }) => echeance)
    .filter((echeance) => echeance > maintenant)
    .sort()
  return {
    dues: choix.dues.flatMap((id) => rendre(id, false)),
    nouvelles: choix.nouvelles.flatMap((id) => rendre(id, true)),
    prochaine: prochaines[0] ?? null,
  }
}

/** L'état de la carte après une note : une carte jamais vue part d'une carte neuve. */
export function apresNote(
  avant: EtatGarde | null,
  note: NoteCarte,
  noteId: string,
  maintenant: string,
  reglages: Reglages,
): EtatGarde {
  const depart: EtatCarte = avant ?? carteNeuve(maintenant)
  return {
    ...noterCarte(depart, note, maintenant, reglages),
    introduiteLe: avant?.introduiteLe ?? maintenant,
    noteId,
  }
}

/** Le module en cours : celui du bloc en cours, sinon le premier du plan ; `null` si rien n'est importé. */
export function moduleEnCours(plan: readonly BlocDuPlan[], contexte: ContexteDuJour) {
  const courant = plan.find(({ code }) => code === contexte.enCours) ?? plan.at(0)
  if (courant === undefined) return null
  return {
    id: courant.moduleCode,
    titre: courant.moduleTitre,
    blocs: contexte.blocs
      .filter(({ moduleId }) => moduleId === courant.moduleId)
      .map(({ manifeste, etat }) => ({
        bloc: manifeste.bloc,
        titre_court: manifeste.titre_court,
        statut: etat.statut,
      })),
  }
}
