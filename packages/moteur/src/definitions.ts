import type { Reglages, Statut } from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'
import { comparer } from './ordre.ts'
import { instantEnMs, jourDe } from './temps.ts'
import type { Jour } from './temps.ts'

// Définitions communes du cadrage : bloc en cours, séance, validité d'une vérification.

const MS_PAR_MINUTE = 60_000
const MS_PAR_HEURE = 60 * MS_PAR_MINUTE
/** Deux faits séparés de moins de 30 minutes sont dans la même séance. */
const ECART_DE_SEANCE_MINUTES = 30

/** Un bloc du plan, avec son statut et la date de son dernier fait. */
export interface BlocDuPlan {
  readonly bloc: string
  readonly statut: Statut
  readonly dernierFait: string | null
}

/**
 * Le bloc en cours : celui, `en_cours` ou `vu`, dont le dernier fait est le plus récent (à égalité,
 * le premier du plan) ; à défaut, le premier bloc `non_commence` dans l'ordre du plan.
 * `blocs` est donné dans l'ordre du plan.
 */
export function blocEnCours(blocs: readonly BlocDuPlan[]): string | null {
  const actifs = blocs.flatMap((bloc) =>
    (bloc.statut === 'en_cours' || bloc.statut === 'vu') && bloc.dernierFait !== null
      ? [{ bloc: bloc.bloc, ms: instantEnMs(bloc.dernierFait) }]
      : [],
  )
  const recent = actifs.reduce<{ bloc: string; ms: number } | null>(
    (meilleur, candidat) => (meilleur === null || candidat.ms > meilleur.ms ? candidat : meilleur),
    null,
  )
  if (recent !== null) return recent.bloc
  return blocs.find((bloc) => bloc.statut === 'non_commence')?.bloc ?? null
}

export interface Seance {
  readonly debut: string
  readonly fin: string
  /** Le jour (avec la bascule du jour) du premier fait de la séance. */
  readonly jour: Jour
  /** Identifiants des faits de la séance, dans l'ordre. */
  readonly faits: readonly string[]
}

/** Les séances : des suites de faits séparés de moins de 30 minutes. Les doublons d'identifiant sont ignorés. */
export function seances(faits: readonly Fait[], reglages: Reglages): Seance[] {
  const vus = new Set<string>()
  const tries = faits
    .map((fait) => ({ fait, ms: instantEnMs(fait.date) }))
    .sort((a, b) => a.ms - b.ms || comparer(a.fait.id, b.fait.id))
    .filter(({ fait }) => {
      const nouveau = !vus.has(fait.id)
      vus.add(fait.id)
      return nouveau
    })
  const resultat: { debut: string; fin: string; jour: Jour; faits: string[]; finMs: number }[] = []
  for (const { fait, ms } of tries) {
    const derniere = resultat.at(-1)
    if (derniere !== undefined && ms - derniere.finMs < ECART_DE_SEANCE_MINUTES * MS_PAR_MINUTE) {
      derniere.fin = fait.date
      derniere.finMs = ms
      derniere.faits.push(fait.id)
    } else {
      resultat.push({
        debut: fait.date,
        fin: fait.date,
        jour: jourDe(fait.date, reglages.fuseau, reglages.heureBascule),
        faits: [fait.id],
        finMs: ms,
      })
    }
  }
  return resultat.map(({ debut, fin, jour, faits: ids }) => ({ debut, fin, jour, faits: ids }))
}

export type ValiditeVerification =
  | { readonly valable: true; readonly raison: null }
  | { readonly valable: false; readonly raison: 'revu_avant' | 'avec_support' }

/**
 * Une vérification est valable si la page du bloc n'a pas été ouverte dans les
 * `heuresSansPageAvantVerification` heures avant son début (bornes comprises) et si toutes ses
 * réponses comptent. `faits` sont ceux du bloc vérifié. La page revue prime sur l'aide.
 */
export function validiteVerification(
  faits: readonly Fait[],
  debutIso: string,
  reponses: readonly ReponseVerification[],
  reglages: Reglages,
): ValiditeVerification {
  const debut = instantEnMs(debutIso)
  const fenetre = debut - reglages.heuresSansPageAvantVerification * MS_PAR_HEURE
  const revu = faits.some((fait) => {
    if (fait.type !== 'bloc_ouvert') return false
    const ms = instantEnMs(fait.date)
    return ms >= fenetre && ms <= debut
  })
  if (revu) return { valable: false, raison: 'revu_avant' }
  if (reponses.some((reponse) => !reponse.compte)) return { valable: false, raison: 'avec_support' }
  return { valable: true, raison: null }
}
