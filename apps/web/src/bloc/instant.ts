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
/** Espace insécable : « 1 h 19 » ne se coupe jamais en fin de ligne. */
const INSECABLE = '\u00a0'

interface Calendrier {
  readonly annee: number
  readonly mois: number
  readonly jour: number
  readonly heure: number
  readonly minute: number
}

/** Les éléments du calendrier de cet instant dans le fuseau demandé (celui de l'appareil par défaut). */
function calendrier(instant: string, fuseau: string | undefined): Calendrier {
  const parties = new Intl.DateTimeFormat('en-GB', {
    ...(fuseau === undefined ? {} : { timeZone: fuseau }),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(Date.parse(instant))
  const valeur = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((partie) => partie.type === type)?.value)
  return {
    annee: valeur('year'),
    mois: valeur('month'),
    jour: valeur('day'),
    heure: valeur('hour'),
    minute: valeur('minute'),
  }
}

const nomDuMois = (mois: number) => MOIS[mois - 1] ?? ''

/**
 * « 15 h 20 », précédé de la date (« 7 octobre à 9 h 05 ») quand ce n'est pas le jour de `maintenant`.
 * Les heures sont celles du fuseau des réglages, pas celles de l'appareil.
 */
export function formaterInstant(instant: string, maintenant: string, fuseau?: string): string {
  const date = calendrier(instant, fuseau)
  const ref = calendrier(maintenant, fuseau)
  const heure = `${String(date.heure)}${INSECABLE}h${INSECABLE}${deuxChiffres(date.minute)}`
  const memeJour = date.annee === ref.annee && date.mois === ref.mois && date.jour === ref.jour
  return memeJour ? heure : `${String(date.jour)}${INSECABLE}${nomDuMois(date.mois)} à ${heure}`
}

/** Un délai en minutes, dit à la française : « 1 h », « 45 min », « 1 h 30 ». */
export function formaterDelai(minutes: number): string {
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  if (heures === 0) return `${String(reste)}${INSECABLE}min`
  return reste === 0
    ? `${String(heures)}${INSECABLE}h`
    : `${String(heures)}${INSECABLE}h${INSECABLE}${deuxChiffres(reste)}`
}
