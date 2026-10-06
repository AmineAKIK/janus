const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

const deuxChiffres = (nombre: number) => String(nombre).padStart(2, '0')

/** « 15 h 20 », précédé de la date (« 7 octobre à 9 h 05 ») quand ce n'est pas le jour de `maintenant`. */
export function formaterInstant(instant: string, maintenant: string): string {
  const date = new Date(instant)
  const heure = `${String(date.getHours())} h ${deuxChiffres(date.getMinutes())}`
  const ref = new Date(maintenant)
  const memeJour =
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  return memeJour ? heure : `${String(date.getDate())} ${MOIS[date.getMonth()] ?? ''} à ${heure}`
}

/** La date seule, « 7 octobre ». */
export function formaterJour(instant: string): string {
  const date = new Date(instant)
  return `${String(date.getDate())} ${MOIS[date.getMonth()] ?? ''}`
}

/** Un délai en minutes, dit à la française : « 1 h », « 45 min », « 1 h 30 ». */
export function formaterDelai(minutes: number): string {
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  if (heures === 0) return `${String(reste)} min`
  return reste === 0 ? `${String(heures)} h` : `${String(heures)} h ${deuxChiffres(reste)}`
}
