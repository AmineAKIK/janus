import type { Manifeste, Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { SuiviAisance } from '../statutEtapes.ts'

export interface CibleAisance {
  readonly libelle: string
  /** Les paliers, en secondes, dans l'ordre du manifeste. */
  readonly paliersS: readonly number[]
  /** Le meilleur temps d'une réussite, en secondes ; `null` sans réussite. */
  readonly meilleurS: number | null
  /** Les paliers validés, un par jour au plus, dans l'ordre des faits. */
  readonly paliersReussis: number
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
    const suivi = new SuiviAisance(aisance, reglages)
    for (const fait of reussies.toSorted((a, b) => a.date.localeCompare(b.date)))
      suivi.avancer(fait)
    return {
      bloc,
      titre,
      cible: {
        libelle: aisance.libelle,
        paliersS: aisance.paliers_s,
        meilleurS: reussies.length === 0 ? null : Math.min(...reussies.map(({ dureeS }) => dureeS)),
        paliersReussis: suivi.paliers,
      },
    }
  })
}
