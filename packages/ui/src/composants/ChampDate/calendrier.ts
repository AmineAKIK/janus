/** Le calendrier en dates `AAAA-MM-JJ`, sans horloge : « aujourd'hui » vient toujours de l'appelant. */

export interface Jour {
  readonly annee: number
  readonly mois: number
  readonly jour: number
}

const MOTIF = /^(\d{4})-(\d{2})-(\d{2})$/

export function analyser(texte: string): Jour | null {
  const lu = MOTIF.exec(texte)
  if (lu === null) return null
  const annee = Number(lu[1])
  const mois = Number(lu[2])
  const jour = Number(lu[3])
  if (mois < 1 || mois > 12 || jour < 1 || jour > joursDuMois(annee, mois)) return null
  return { annee, mois, jour }
}

export function formater({ annee, mois, jour }: Jour): string {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

function joursDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

function depuisUtc(date: Date): Jour {
  return { annee: date.getUTCFullYear(), mois: date.getUTCMonth() + 1, jour: date.getUTCDate() }
}

/** Décale d'un nombre de jours. */
export function ajouterJours(jour: Jour, nombre: number): Jour {
  return depuisUtc(new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour + nombre)))
}

/** Décale d'un nombre de mois, en gardant le jour ou le dernier jour du mois d'arrivée. */
export function ajouterMois(jour: Jour, nombre: number): Jour {
  const total = jour.annee * 12 + (jour.mois - 1) + nombre
  const annee = Math.floor(total / 12)
  const mois = (total % 12) + 1
  return { annee, mois, jour: Math.min(jour.jour, joursDuMois(annee, mois)) }
}

/** 0 pour lundi, 6 pour dimanche. */
export function jourDeSemaine({ annee, mois, jour }: Jour): number {
  return (new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay() + 6) % 7
}

/** Les six semaines d'un mois, du lundi au dimanche, avec les jours des mois voisins qui les complètent. */
export function grilleDuMois(annee: number, mois: number): readonly (readonly Jour[])[] {
  const premier: Jour = { annee, mois, jour: 1 }
  const debut = ajouterJours(premier, -jourDeSemaine(premier))
  return Array.from({ length: 6 }, (_, semaine) =>
    Array.from({ length: 7 }, (_, index) => ajouterJours(debut, semaine * 7 + index)),
  )
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const SEMAINE_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' })
const SEMAINE_COURT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })

const utc = ({ annee, mois, jour }: Jour) => new Date(Date.UTC(annee, mois - 1, jour))

/** « octobre 2026 » */
export const libelleMois = (jour: Jour) => MOIS.format(utc(jour))
/** « 12 octobre 2026 » */
export const libelleLong = (jour: Jour) => LONG.format(utc(jour))

/** Les sept jours de la semaine, du lundi au dimanche : nom entier et abréviation (« lu »). */
export function enTetesSemaine(): readonly { readonly nom: string; readonly court: string }[] {
  // Le 5 janvier 2026 est un lundi.
  return Array.from({ length: 7 }, (_, index) => {
    const date = utc({ annee: 2026, mois: 1, jour: 5 + index })
    return {
      nom: SEMAINE_LONG.format(date),
      court: SEMAINE_COURT.format(date).replace('.', '').slice(0, 2),
    }
  })
}

export const memeJour = (a: Jour, b: Jour) =>
  a.annee === b.annee && a.mois === b.mois && a.jour === b.jour
