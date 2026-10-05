import type { Statut } from '@janus/contrats'

export interface Compteurs {
  readonly total: number
  /** Les blocs commencés, quel que soit leur statut. */
  readonly ouverts: number
  /** « Acquis » et « maîtrisé » comptent, pas « acquis provisoirement ». */
  readonly acquis: number
}

export function compter(statuts: readonly Statut[]): Compteurs {
  return {
    total: statuts.length,
    ouverts: statuts.filter((statut) => statut !== 'non_commence').length,
    acquis: statuts.filter((statut) => statut === 'acquis' || statut === 'maitrise').length,
  }
}

/** Le statut d'une formation ou d'un module : commencé ou non. */
export function statutGlobal(statuts: readonly Statut[]): Statut {
  return compter(statuts).ouverts > 0 ? 'en_cours' : 'non_commence'
}

/** Accorde un nom avec son nombre : 0 et 1 restent au singulier. */
export function accorder(nombre: number, singulier: string, pluriel: string): string {
  return `${String(nombre)} ${nombre < 2 ? singulier : pluriel}`
}
