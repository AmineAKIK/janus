import type { Manifeste, Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { jourDe } from '../temps.ts'

export interface CibleAisance {
  readonly libelle: string
  /** L'objectif, en secondes. */
  readonly objectifS: number
  /** Le meilleur temps d'une réussite, en secondes ; `null` sans réussite. */
  readonly meilleurS: number | null
  /** Les réussites sous l'objectif. */
  readonly reussites: number
  readonly reussitesRequises: number
  /** Les jours différents où il y en a eu. */
  readonly jours: number
  readonly joursRequis: number
}

export interface LigneAisance {
  readonly bloc: string
  readonly titre: string
  /** `null` : le bloc n'a pas de cible d'aisance (« non requis »). */
  readonly cible: CibleAisance | null
}

/** Le temps observé face aux objectifs réels, un bloc par ligne, dans l'ordre des manifestes. */
export function aisanceDesBlocs(
  manifestes: readonly Manifeste[],
  faits: readonly Fait[],
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): readonly LigneAisance[] {
  return manifestes.map(({ bloc, titre_court: titre, aisance }) => {
    if (aisance === undefined) return { bloc, titre, cible: null }
    const reussies = faits.flatMap((fait) =>
      fait.type === 'aisance_resultat' && fait.bloc === bloc && fait.reussi ? [fait] : [],
    )
    const sousObjectif = reussies.filter(({ dureeS }) => dureeS <= aisance.duree_max_s)
    return {
      bloc,
      titre,
      cible: {
        libelle: aisance.libelle,
        objectifS: aisance.duree_max_s,
        meilleurS: reussies.length === 0 ? null : Math.min(...reussies.map(({ dureeS }) => dureeS)),
        reussites: sousObjectif.length,
        reussitesRequises: aisance.reussites_requises,
        jours: new Set(
          sousObjectif.map(({ date }) => jourDe(date, reglages.fuseau, reglages.heureBascule)),
        ).size,
        joursRequis: aisance.sur_jours_differents,
      },
    }
  })
}
