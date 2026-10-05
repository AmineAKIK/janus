import type { z } from 'zod'
import type { CodeProbleme } from './api/commun.ts'
import type { DefinitionRoute } from './api/routes.ts'

type PartieDEntree = 'params' | 'requete' | 'corps'

/** La partie `K` de l'entrée : exigée si la route la définit, interdite sinon. */
type Partie<D extends DefinitionRoute, K extends PartieDEntree> =
  D extends Record<K, infer S extends z.ZodType>
    ? { readonly [P in K]: z.input<S> }
    : { readonly [P in K]?: never }

/** Ce que l'appelant donne : les paramètres d'URL, la requête et le corps que la route définit. */
export type EntreeRoute<D extends DefinitionRoute> = Partie<D, 'params'> &
  Partie<D, 'requete'> &
  Partie<D, 'corps'>

type PartieLue<D extends DefinitionRoute, K extends PartieDEntree> =
  D extends Record<K, infer S extends z.ZodType> ? z.output<S> : undefined

/** L'entrée telle qu'une route la lit, une fois validée : ses valeurs ont le type des schémas de la route. */
export interface EntreeLue<D extends DefinitionRoute> {
  readonly params: PartieLue<D, 'params'>
  readonly requete: PartieLue<D, 'requete'>
  readonly corps: PartieLue<D, 'corps'>
}

/** Ce que l'appelant reçoit : la réponse validée, ou `null` pour une réponse sans corps. */
export type SortieRoute<D extends DefinitionRoute> = D['reponse'] extends z.ZodType
  ? z.output<D['reponse']>
  : null

export interface OptionsAppel {
  readonly signal?: AbortSignal
}

/**
 * Le seul point de passage des données : l'appli appelle une route de `packages/contrats/api`,
 * par HTTP ou contre le backend de démo, sans savoir laquelle. L'entrée est validée avant l'envoi,
 * la sortie à la réception : une donnée non vérifiée n'arrive jamais à l'écran.
 */
export interface Transport {
  appeler<D extends DefinitionRoute>(
    route: D,
    entree: EntreeRoute<D>,
    options?: OptionsAppel,
  ): Promise<SortieRoute<D>>
}

/** Une erreur renvoyée par l'API (`application/problem+json`) ou fabriquée à sa place. */
export class ErreurApi extends Error {
  readonly status: number
  readonly code: CodeProbleme
  readonly titre: string
  readonly detail: string
  /** Secondes à attendre avant de réessayer (`Retry-After`). */
  readonly retryAfter: number | undefined

  constructor(proprietes: {
    status: number
    code: CodeProbleme
    titre: string
    detail: string
    retryAfter?: number
  }) {
    super(`${proprietes.titre} (${String(proprietes.status)}) : ${proprietes.detail}`)
    this.name = 'ErreurApi'
    this.status = proprietes.status
    this.code = proprietes.code
    this.titre = proprietes.titre
    this.detail = proprietes.detail
    this.retryAfter = proprietes.retryAfter
  }
}

/** Le serveur est injoignable : pas de réponse du tout. */
export class ErreurReseau extends Error {
  constructor(options?: ErrorOptions) {
    super('Le serveur est injoignable.', options)
    this.name = 'ErreurReseau'
  }
}

/** Une entrée ou une sortie qui ne respecte pas le schéma de la route. */
export class ErreurDonnees extends Error {
  readonly sens: 'entree' | 'sortie'
  readonly route: string
  readonly erreurs: readonly z.core.$ZodIssue[]

  constructor(sens: 'entree' | 'sortie', route: string, erreurs: readonly z.core.$ZodIssue[]) {
    const resume = erreurs
      .map((e) => `${e.path.join('.') || '(racine)'} : ${e.message}`)
      .join(' ; ')
    super(`${sens === 'entree' ? 'Entrée' : 'Réponse'} invalide pour ${route} : ${resume}`)
    this.name = 'ErreurDonnees'
    this.sens = sens
    this.route = route
    this.erreurs = erreurs
  }
}

/** « MÉTHODE chemin », comme dans `ROUTES`. */
export function nomRoute(route: DefinitionRoute): string {
  return `${route.methode} ${route.chemin}`
}

export interface EntreeValidee {
  readonly params: Record<string, unknown> | undefined
  readonly requete: Record<string, unknown> | undefined
  readonly corps: unknown
}

function valider(schema: z.ZodType | undefined, valeur: unknown, route: DefinitionRoute) {
  if (schema === undefined) return undefined
  const resultat = schema.safeParse(valeur)
  if (!resultat.success) throw new ErreurDonnees('entree', nomRoute(route), resultat.error.issues)
  return resultat.data
}

/** Valide l'entrée contre les schémas de la route ; lève `ErreurDonnees` sinon. */
export function validerEntree<D extends DefinitionRoute>(
  route: D,
  entree: EntreeRoute<D>,
): EntreeValidee {
  const brut: Partial<Record<PartieDEntree, unknown>> = entree
  const params = valider(route.params, brut.params, route)
  const requete = valider(route.requete, brut.requete, route)
  return {
    params: params as Record<string, unknown> | undefined,
    requete: requete as Record<string, unknown> | undefined,
    corps: valider(route.corps, brut.corps, route),
  }
}

/** Valide la réponse ; lève `ErreurDonnees` si elle ne respecte pas son schéma. */
export function validerSortie<D extends DefinitionRoute>(route: D, brut: unknown): SortieRoute<D> {
  if (route.reponse === null) return null as SortieRoute<D>
  const resultat = route.reponse.safeParse(brut)
  if (!resultat.success) throw new ErreurDonnees('sortie', nomRoute(route), resultat.error.issues)
  return resultat.data as SortieRoute<D>
}

/** Remplace les `:parametres` du chemin par leurs valeurs, encodées. */
export function remplirChemin(chemin: string, params: Record<string, unknown> | undefined): string {
  return chemin.replace(/:(\w+)/g, (_, nom: string) => {
    const valeur = params?.[nom]
    if (typeof valeur !== 'string') throw new Error(`Paramètre « ${nom} » manquant pour ${chemin}`)
    return encodeURIComponent(valeur)
  })
}

/** Redonne leur type aux parties d'une entrée déjà validée par `validerEntree` (même schéma, même résultat). */
export function lireEntree<D extends DefinitionRoute>(
  route: D,
  entree: EntreeValidee,
): EntreeLue<D> {
  const lire = (schema: z.ZodType | undefined, valeur: unknown): unknown =>
    schema === undefined ? undefined : schema.parse(valeur)
  return {
    params: lire(route.params, entree.params),
    requete: lire(route.requete, entree.requete),
    corps: lire(route.corps, entree.corps),
  } as EntreeLue<D>
}
