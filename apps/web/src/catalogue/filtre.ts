import type { Statut } from '@janus/contrats'

export type FiltreBlocs = 'tous' | 'a_faire' | 'a_reprendre'

/** Le filtre de l'adresse (`?statut=…`) ; une valeur inconnue affiche tous les blocs. */
export function lireFiltre(statut: string | undefined): FiltreBlocs {
  return statut === 'a_faire' || statut === 'a_reprendre' ? statut : 'tous'
}

/** « À faire » : tout ce qui n'est pas encore acquis ni maîtrisé. */
export function correspond(filtre: FiltreBlocs, statut: Statut): boolean {
  switch (filtre) {
    case 'tous':
      return true
    case 'a_reprendre':
      return statut === 'a_reprendre'
    case 'a_faire':
      return statut !== 'acquis' && statut !== 'maitrise'
  }
}

export interface GroupeBlocs<B> {
  readonly partie: string
  /** « B01–B04 », calculée sur tous les blocs de la partie, filtrés ou non. */
  readonly plage: string
  readonly blocs: readonly B[]
}

/** Regroupe par partie, dans l'ordre du plan, et masque les parties vides une fois filtrées. */
export function grouper<
  B extends { readonly bloc: string; readonly partie: string; readonly statut: Statut },
>(blocs: readonly B[], filtre: FiltreBlocs): readonly GroupeBlocs<B>[] {
  const parties = [...new Set(blocs.map(({ partie }) => partie))]
  return parties.flatMap((partie) => {
    const dedans = blocs.filter((bloc) => bloc.partie === partie)
    const premier = dedans[0]?.bloc ?? ''
    const dernier = dedans.at(-1)?.bloc ?? ''
    const gardes = dedans.filter(({ statut }) => correspond(filtre, statut))
    return gardes.length === 0
      ? []
      : [{ partie, plage: premier === dernier ? premier : `${premier}–${dernier}`, blocs: gardes }]
  })
}
