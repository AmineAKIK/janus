const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMAT_INSTANT = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/
const MS_PAR_JOUR = 86_400_000

/** Un jour au format `AAAA-MM-JJ`. */
export type Jour = string

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0')
}

function enJour(date: Date): Jour {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${deuxChiffres(date.getUTCMonth() + 1)}-${deuxChiffres(date.getUTCDate())}`
}

/** Lit un jour `AAAA-MM-JJ` comme minuit UTC ; refuse un jour mal formé ou qui n'existe pas. */
function lireJour(jour: Jour): Date {
  const trouve = FORMAT_JOUR.exec(jour)
  if (trouve === null) throw new Error(`Jour illisible : ${jour}`)
  const date = new Date(Date.UTC(Number(trouve[1]), Number(trouve[2]) - 1, Number(trouve[3])))
  if (enJour(date) !== jour) throw new Error(`Jour illisible : ${jour}`)
  return date
}

/** Lit un instant ISO 8601 en UTC (`AAAA-MM-JJThh:mm:ss[.sss]Z`) ; refuse tout le reste, jour impossible ou offset absent compris. */
export function instantEnMs(instantIso: string): number {
  const jour = FORMAT_INSTANT.exec(instantIso)?.[1]
  if (jour === undefined || !jourExiste(jour)) throw new Error(`Instant illisible : ${instantIso}`)
  return Date.parse(instantIso)
}

function jourExiste(jour: Jour): boolean {
  try {
    lireJour(jour)
    return true
  } catch {
    return false
  }
}

/** L'instant ISO 8601 UTC d'un nombre de millisecondes depuis 1970. */
export function instantEnIso(ms: number): string {
  return new Date(ms).toISOString()
}

/**
 * Le jour auquel compte un instant : la date locale du fuseau, moins un jour
 * tant qu'il est avant `heureBascule` (une séance à 1 h 30 compte pour la veille).
 */
export function jourDe(instantIso: string, fuseau: string, heureBascule: number): Jour {
  const instant = instantEnMs(instantIso)
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const champs = Object.fromEntries(parties.map(({ type, value }) => [type, value]))
  const dateLocale = enJour(
    new Date(Date.UTC(Number(champs['year']), Number(champs['month']) - 1, Number(champs['day']))),
  )
  return Number(champs['hour']) < heureBascule ? ajouterJours(dateLocale, -1) : dateLocale
}

/** Ajoute (ou retire, si négatif) des jours calendaires : aucun changement d'heure ne s'en mêle. */
export function ajouterJours(jour: Jour, nombre: number): Jour {
  return enJour(new Date(lireJour(jour).getTime() + nombre * MS_PAR_JOUR))
}

/** Ajoute des mois en gardant le quantième, ou le dernier jour du mois s'il n'existe pas (31 janvier + 1 mois = 28 février). */
export function ajouterMois(jour: Jour, nombre: number): Jour {
  const depart = lireJour(jour)
  const cible = new Date(Date.UTC(depart.getUTCFullYear(), depart.getUTCMonth() + nombre, 1))
  const dernier = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0),
  ).getUTCDate()
  cible.setUTCDate(Math.min(depart.getUTCDate(), dernier))
  return enJour(cible)
}

/** Nombre de jours de `depart` à `arrivee` ; négatif si `arrivee` est avant. */
export function ecartEnJours(depart: Jour, arrivee: Jour): number {
  return Math.round((lireJour(arrivee).getTime() - lireJour(depart).getTime()) / MS_PAR_JOUR)
}
