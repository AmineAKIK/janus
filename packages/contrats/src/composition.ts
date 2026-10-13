import { z } from 'zod'
import { FormeTransfert, TypeDifferee } from './enums.ts'

/** Les types de contenu de la méthode utiles à un bloc : ils décident de ce que la vérification tire. */
export const TypeDeContenu = z.enum(['systemes', 'procedures', 'regles_cas', 'conventions'])
export type TypeDeContenu = z.infer<typeof TypeDeContenu>

export interface Reserves {
  /** Les types de questions différées que la vérification, le retest et l'entretien tirent, dans l'ordre. */
  readonly parties: readonly TypeDifferee[]
  /** Les formes de transfert que le manifeste doit couvrir (vide si le type ne tire pas de transfert). */
  readonly formes: readonly FormeTransfert[]
}

const RESERVES: Readonly<Record<TypeDeContenu, Reserves>> = {
  systemes: {
    parties: ['explication', 'transfert'],
    formes: ['choisir_methode', 'adapter_condition', 'hors_champ'],
  },
  procedures: { parties: ['tache', 'transfert'], formes: ['adapter_condition', 'trouver_erreur'] },
  regles_cas: {
    parties: ['explication', 'transfert'],
    formes: ['adapter_condition', 'trouver_erreur', 'hors_champ'],
  },
  conventions: { parties: ['explication'], formes: [] },
}

/** Sans type déclaré : la composition complète du cadrage d'origine (explication, tâche, transfert). */
const RESERVES_COMPLETES: Reserves = {
  parties: TypeDifferee.options,
  formes: FormeTransfert.options,
}

/** Les réserves exigées pour un type de contenu, et donc la composition d'une vérification. */
export function reservesDuType(type: TypeDeContenu | undefined): Reserves {
  return type === undefined ? RESERVES_COMPLETES : RESERVES[type]
}
