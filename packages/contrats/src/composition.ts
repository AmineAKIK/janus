import { z } from 'zod'
import { FormeTransfert, TypeDifferee } from './enums.ts'

/** Les types de contenu de la méthode utiles à un bloc : ils décident de ce que la vérification tire. */
export const TypeDeContenu = z.enum(['systemes', 'procedures', 'regles_cas', 'conventions'])
export type TypeDeContenu = z.infer<typeof TypeDeContenu>

/**
 * Le type d'un bloc : un seul, ou plusieurs quand le bloc les mêle (B03 : un système, et les gestes
 * pour relever sa machine). Plusieurs types tirent l'union de leurs réserves.
 */
export const TypeDuBloc = z.union([TypeDeContenu, z.array(TypeDeContenu).min(2)])
export type TypeDuBloc = z.infer<typeof TypeDuBloc>

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

/**
 * Les réserves exigées pour un type de contenu, et donc la composition d'une vérification. Plusieurs
 * types : l'union de leurs parties et de leurs formes, dans l'ordre du cadrage.
 */
export function reservesDuType(type: TypeDuBloc | undefined): Reserves {
  if (type === undefined) return RESERVES_COMPLETES
  if (typeof type === 'string') return RESERVES[type]
  const parties = new Set(type.flatMap((t) => RESERVES[t].parties))
  const formes = new Set(type.flatMap((t) => RESERVES[t].formes))
  return {
    parties: TypeDifferee.options.filter((partie) => parties.has(partie)),
    formes: FormeTransfert.options.filter((forme) => formes.has(forme)),
  }
}
