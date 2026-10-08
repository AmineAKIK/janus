import { ResultatVerification, TypeDifferee } from '@janus/contrats'
import type { Differee, Fait, Manifeste, Reglages } from '@janus/contrats'
import { echeances, jourDe, tirerDifferee } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { z } from 'zod'

/** Les trois parties tirées d'une vérification, dans l'ordre : ce que `verifications_tirees` garde. */
export const Tirage = z.array(z.strictObject({ id: z.string(), type: TypeDifferee }))
export type Tirage = z.infer<typeof Tirage>

const TYPES_DE_PARTIES = TypeDifferee.options
const HEURE_MS = 3_600_000

/** Tire une question de chaque type, jamais la même deux fois de suite (réserve épuisée : la plus ancienne). */
export function tirerParties(
  manifeste: Manifeste,
  faits: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): Tirage {
  const dejaPosees = faits.flatMap((fait) =>
    fait.type === 'verification_terminee'
      ? fait.reponses.map(({ question }) => ({ question, date: fait.date }))
      : [],
  )
  return TYPES_DE_PARTIES.flatMap((type) => {
    const differee = tirerDifferee(manifeste, type, dejaPosees, maintenant, reglages)
    return differee === null ? [] : [{ id: differee.id, type }]
  })
}

/** Ce que la page voit d'une partie : la consigne et le mode de la tâche, jamais l'attendu. */
export function partieVisible(differee: Differee, envoyee: boolean) {
  const mode = differee.verification
  return {
    id: differee.id,
    type: differee.type,
    consigne: differee.consigne,
    ...(differee.type !== 'tache'
      ? {}
      : mode?.mode === 'code'
        ? { tache: { mode: 'code' as const, langage: mode.langage, cas: mode.cas } }
        : { tache: { mode: 'exacte' as const } }),
    envoyee,
  }
}

/** La page du bloc a-t-elle été ouverte dans la fenêtre sans page avant la vérification ? */
export function revuRecemment(
  faitsDuBloc: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): 'hier' | 'aujourdhui' | null {
  const fenetre = reglages.heuresSansPageAvantVerification * HEURE_MS
  const derniere = faitsDuBloc
    .filter(
      (fait) =>
        fait.type === 'bloc_ouvert' &&
        Date.parse(maintenant) - Date.parse(fait.date) <= fenetre &&
        Date.parse(fait.date) <= Date.parse(maintenant),
    )
    .map(({ date }) => date)
    .sort()
    .at(-1)
  if (derniere === undefined) return null
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  return jour(derniere) === jour(maintenant) ? 'aujourdhui' : 'hier'
}

/** Le jour à partir duquel la vérification est due : l'échéance du bloc, ou le report s'il va plus loin. */
export function dateDue(
  etat: ResultatBloc,
  reglages: Reglages,
  maintenant: string,
  reporteeJusqua: string | null,
): string {
  const echeance = echeances(etat, reglages)
  const attendue =
    echeance?.genre === 'jour'
      ? echeance.apres
      : jourDe(maintenant, reglages.fuseau, reglages.heureBascule)
  return reporteeJusqua !== null && reporteeJusqua > attendue ? reporteeJusqua : attendue
}

/** Les événements d'une vérification, tels que `evenements` les garde (le moteur n'en lit aucun). */
export const EvenementReport = z.looseObject({ jusqua: z.string() })
export const EvenementResultat = z.looseObject({ resultat: ResultatVerification })
export const EvenementPartie = z.looseObject({ partie: z.string() })
