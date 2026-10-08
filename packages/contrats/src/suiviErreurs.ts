/**
 * Le suivi d'erreurs facultatif (Sentry ou GlitchTip) : de quoi fabriquer l'envoi d'une erreur,
 * rien d'autre. Jamais le message de l'erreur, une réponse ou un texte saisi : le type, la pile et
 * quelques étiquettes sans donnée personnelle.
 */

export interface Dsn {
  /** L'adresse où poster l'enveloppe, clé publique comprise. */
  readonly urlEnvoi: string
}

/** Lit un DSN (`https://<clé>@<hôte>/<projet>`) ; `null` s'il est absent ou invalide. */
export function lireDsn(dsn: string | undefined): Dsn | null {
  if (dsn === undefined || dsn === '') return null
  let url: URL
  try {
    url = new URL(dsn)
  } catch {
    return null
  }
  const segments = url.pathname.split('/').filter((segment) => segment !== '')
  const projet = segments.pop()
  if (url.username === '' || projet === undefined) return null
  const prefixe = segments.map((segment) => `/${segment}`).join('')
  const cle = encodeURIComponent(url.username)
  return {
    urlEnvoi: `${url.protocol}//${url.host}${prefixe}/api/${projet}/envelope/?sentry_key=${cle}&sentry_version=7`,
  }
}

export interface ErreurSignalee {
  readonly nom: string
  readonly pile: string
  /** Des étiquettes courtes (la route, la méthode) : jamais une valeur saisie. */
  readonly etiquettes?: Readonly<Record<string, string>>
}

interface Cadre {
  readonly function?: string
  readonly filename: string
  readonly lineno: number
  readonly colno: number
}

const CADRE_V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/
const CADRE_GECKO = /^(.*?)@(.+?):(\d+):(\d+)$/

/** Les cadres de la pile (les lignes qui n'en sont pas, dont le message, sont écartées), le plus ancien d'abord. */
function cadresDeLaPile(pile: string): Cadre[] {
  const cadres: Cadre[] = []
  for (const ligne of pile.split('\n')) {
    const lu = CADRE_V8.exec(ligne) ?? CADRE_GECKO.exec(ligne)
    if (lu === null) continue
    const [, fonction, fichier, ligneN, colonne] = lu
    if (fichier === undefined || ligneN === undefined || colonne === undefined) continue
    cadres.push({
      ...(fonction === undefined || fonction === '' ? {} : { function: fonction }),
      filename: fichier,
      lineno: Number(ligneN),
      colno: Number(colonne),
    })
  }
  return cadres.reverse()
}

export interface ContexteEnvoi {
  readonly plateforme: 'node' | 'javascript'
  /** L'instant de l'erreur, en ISO 8601, fourni par l'horloge. */
  readonly instant: string
  /** 32 caractères hexadécimaux, uniques. */
  readonly identifiant: string
}

/** L'enveloppe prête à poster : l'adresse et le corps. */
export function construireEnvoi(
  dsn: Dsn,
  erreur: ErreurSignalee,
  { plateforme, instant, identifiant }: ContexteEnvoi,
): { readonly url: string; readonly corps: string } {
  const evenement = {
    event_id: identifiant,
    timestamp: instant,
    platform: plateforme,
    level: 'error',
    exception: {
      values: [{ type: erreur.nom, stacktrace: { frames: cadresDeLaPile(erreur.pile) } }],
    },
    ...(erreur.etiquettes === undefined ? {} : { tags: erreur.etiquettes }),
  }
  const corps = [
    JSON.stringify({ event_id: identifiant, sent_at: instant }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(evenement),
  ].join('\n')
  return { url: dsn.urlEnvoi, corps: `${corps}\n` }
}
