import type { Statut } from '@janus/contrats'

export interface BlocDeCarte {
  readonly bloc: string
  readonly partie: string
  readonly prerequis: readonly string[]
  readonly statut: Statut
  readonly force: boolean
  /** Redescendu d'un cran après des échecs de vérification. */
  readonly descendu: boolean
}

export interface BlocMarque extends BlocDeCarte {
  /** Ouvert sans que ses prérequis soient validés. */
  readonly prerequisNonValides: boolean
  readonly redescendu: boolean
}

/** La carte du module : chaque bloc garde sa place, et reçoit ses marques. */
export function carteDuModule(
  blocs: readonly BlocDeCarte[],
  ouvertsSansPrerequis: ReadonlySet<string>,
): readonly BlocMarque[] {
  return blocs.map((bloc) => ({
    ...bloc,
    prerequisNonValides: ouvertsSansPrerequis.has(bloc.bloc),
    redescendu: bloc.descendu,
  }))
}
