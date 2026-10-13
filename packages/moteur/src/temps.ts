import { CacheBorne } from './cacheBorne.ts'

const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMAT_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/
/** Une minute en millisecondes. */
export const MS_PAR_MINUTE = 60_000
const MS_PAR_JOUR = 86_400_000
/** Combien d'instants chaque cache retient avant de repartir de zéro. */
const CAPACITE_DU_CACHE = 250_000

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

/**
 * Vrai quand `AAAA-MM-JJ` existe au calendrier. Même verdict que passer par `Date` puis relire le jour
 * (ce que fait `lireJour`), sans construire de date : les années avant 100 sont refusées, `Date.UTC`
 * les prenant pour des années 19xx.
 */
function jourExiste(annee: number, mois: number, jour: number): boolean {
  if (annee < 100 || mois < 1 || mois > 12 || jour < 1) return false
  // Le jour 0 du mois suivant est le dernier jour de celui-ci.
  return jour <= new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

/**
 * Les instants déjà lus : les mêmes faits sont lus et comparés des dizaines de fois par requête, et
 * lire un instant (expression régulière, puis `Date.parse`) coûte dix fois plus qu'une recherche ici.
 * Seuls les instants valides y entrent. Borné : au-delà de `MAX_INSTANTS` entrées, on repart de zéro.
 */
const INSTANTS = new CacheBorne<number>(CAPACITE_DU_CACHE)

/** Lit un instant ISO 8601 en UTC (`AAAA-MM-JJThh:mm:ss[.sss]Z`) ; refuse tout le reste, jour impossible ou offset absent compris. */
export function instantEnMs(instantIso: string): number {
  const connu = INSTANTS.lire(instantIso)
  if (connu !== undefined) return connu
  const trouve = FORMAT_INSTANT.exec(instantIso)
  if (trouve === null || !jourExiste(Number(trouve[1]), Number(trouve[2]), Number(trouve[3]))) {
    throw new Error(`Instant illisible : ${instantIso}`)
  }
  const ms = Date.parse(instantIso)
  INSTANTS.ecrire(instantIso, ms)
  return ms
}

/** L'instant ISO 8601 UTC d'un nombre de millisecondes depuis 1970. */
export function instantEnIso(ms: number): string {
  return new Date(ms).toISOString()
}

/** La date et l'heure locales d'un instant dans un fuseau ; `veille` n'est calculée qu'au premier besoin. */
interface Local {
  readonly date: Jour
  readonly heure: number
  veille?: Jour
}

/**
 * Construire un `Intl.DateTimeFormat` coûte une centaine de microsecondes, soit presque tout le prix de
 * `jourDe` : un seul par fuseau, gardé tant que le processus vit.
 */
const FORMATEURS = new Map<string, Intl.DateTimeFormat>()
/**
 * Les instants déjà convertis, par fuseau : une lecture rejoue les mêmes faits à chaque requête, et
 * `jourDe` en croise plusieurs fois le même.
 */
const LOCAUX = new Map<string, CacheBorne<Local>>()

function formateurDe(fuseau: string): Intl.DateTimeFormat {
  let formateur = FORMATEURS.get(fuseau)
  if (formateur === undefined) {
    formateur = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
    FORMATEURS.set(fuseau, formateur)
  }
  return formateur
}

function localDe(instantIso: string, fuseau: string): Local {
  const connus = LOCAUX.get(fuseau) ?? new CacheBorne<Local>(CAPACITE_DU_CACHE)
  const deja = connus.lire(instantIso)
  if (deja !== undefined) return deja
  const instant = instantEnMs(instantIso)
  let annee = ''
  let mois = ''
  let jour = ''
  let heure = ''
  for (const { type, value } of formateurDe(fuseau).formatToParts(instant)) {
    if (type === 'year') annee = value
    else if (type === 'month') mois = value
    else if (type === 'day') jour = value
    else if (type === 'hour') heure = value
  }
  const local: Local = {
    date: enJour(new Date(Date.UTC(Number(annee), Number(mois) - 1, Number(jour)))),
    heure: Number(heure),
  }
  LOCAUX.set(fuseau, connus)
  connus.ecrire(instantIso, local)
  return local
}

/**
 * Le jour auquel compte un instant : la date locale du fuseau, moins un jour
 * tant qu'il est avant `heureBascule` (une séance à 1 h 30 compte pour la veille).
 */
export function jourDe(instantIso: string, fuseau: string, heureBascule: number): Jour {
  const local = localDe(instantIso, fuseau)
  if (local.heure >= heureBascule) return local.date
  return (local.veille ??= ajouterJours(local.date, -1))
}

/**
 * Le premier instant qui compte pour ce jour : minuit du fuseau plus l'heure de bascule. C'est
 * l'inverse de `jourDe`, trouvé par dichotomie (`jourDe` ne fait que croître avec l'instant).
 */
export function debutDuJour(jour: Jour, fuseau: string, heureBascule: number): string {
  const minuitUtc = lireJour(jour).getTime()
  let avant = minuitUtc - 2 * MS_PAR_JOUR
  let apres = minuitUtc + 2 * MS_PAR_JOUR
  while (apres - avant > 1) {
    const milieu = Math.floor((avant + apres) / 2)
    if (jourDe(instantEnIso(milieu), fuseau, heureBascule) < jour) avant = milieu
    else apres = milieu
  }
  return instantEnIso(apres)
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
