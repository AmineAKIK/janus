import type { Reglages } from '@janus/contrats'
import { ajouterJours, ecartEnJours, jourDe } from '../temps.ts'
import type { Jour } from '../temps.ts'

type Bascule = Pick<Reglages, 'fuseau' | 'heureBascule'>

/** Le 5 janvier 1970 était un lundi : les semaines se comptent depuis ce jour. */
const UN_LUNDI: Jour = '1970-01-05'

/** Le lundi de la semaine (du lundi au dimanche) qui contient le jour. */
export function lundiDe(jour: Jour): Jour {
  const retard = ((ecartEnJours(UN_LUNDI, jour) % 7) + 7) % 7
  return ajouterJours(jour, -retard)
}

/** Le lundi de la semaine d'un instant, la journée changeant à l'heure de bascule. */
export function semaineDe(instant: string, reglages: Bascule): Jour {
  return lundiDe(jourDe(instant, reglages.fuseau, reglages.heureBascule))
}

/** Les lundis des `nombre` dernières semaines, de la plus ancienne à la semaine courante. */
export function dernieresSemaines(
  maintenant: string,
  reglages: Bascule,
  nombre: number,
): readonly Jour[] {
  const courante = semaineDe(maintenant, reglages)
  return Array.from({ length: nombre }, (_, rang) =>
    ajouterJours(courante, -7 * (nombre - 1 - rang)),
  )
}
