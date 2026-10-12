import {
  ConflitEtatPage,
  ErreurApi,
  ErreurReseau,
  ProblemeApi,
  remplirChemin,
  validerEntree,
  validerSortie,
} from '@janus/contrats'
import type { DefinitionRoute, Transport } from '@janus/contrats'

// Le seul fichier de l'appli qui appelle `fetch` : une règle de lint l'interdit partout ailleurs.

export interface OptionsTransportHttp {
  /** Préfixe de toutes les adresses, par exemple `/api`. */
  readonly base: string
  readonly fetchImpl?: typeof fetch
}

function adresse(base: string, route: DefinitionRoute, entree: ReturnType<typeof validerEntree>) {
  const chemin = `${base.replace(/\/$/, '')}${remplirChemin(route.chemin, entree.params)}`
  const parametres = new URLSearchParams()
  for (const [nom, valeur] of Object.entries(entree.requete ?? {})) {
    if (typeof valeur === 'string' || typeof valeur === 'number' || typeof valeur === 'boolean') {
      parametres.set(nom, String(valeur))
    }
  }
  const requete = parametres.toString()
  return requete === '' ? chemin : `${chemin}?${requete}`
}

/** Le délai de `Retry-After` en secondes ; la forme « date HTTP » n'est pas utilisée par l'API. */
function delaiRetryAfter(reponse: Response): number | undefined {
  const brut = reponse.headers.get('Retry-After')
  const secondes = brut === null ? Number.NaN : Number(brut)
  return Number.isFinite(secondes) && secondes >= 0 ? secondes : undefined
}

async function lireCorps(reponse: Response): Promise<unknown> {
  const type = reponse.headers.get('Content-Type') ?? ''
  try {
    if (!type.includes('json')) return await reponse.text()
    const json: unknown = await reponse.json()
    return json
  } catch {
    return undefined
  }
}

/** Transforme une réponse d'erreur (`problem+json`) en `ErreurApi`. */
async function erreurDeReponse(reponse: Response): Promise<ErreurApi> {
  const corps = await lireCorps(reponse)
  // Le 409 de l'état de page ajoute l'état actuel au problème : c'est bien un conflit, pas une panne.
  const probleme = ProblemeApi.safeParse(corps)
  const conflit = probleme.success ? undefined : ConflitEtatPage.safeParse(corps)
  const retryAfter = delaiRetryAfter(reponse)
  const suite = retryAfter === undefined ? {} : { retryAfter }
  const lu = probleme.success ? probleme.data : conflit?.success ? conflit.data : undefined
  if (lu !== undefined) {
    return new ErreurApi({
      status: reponse.status,
      code: lu.code,
      titre: lu.title,
      detail: lu.detail,
      ...suite,
    })
  }
  // Réponse qui n'est pas un problème de l'API (proxy, panne) : on ne devine pas son contenu.
  return new ErreurApi({
    status: reponse.status,
    code: 'erreur_interne',
    titre: 'Réponse inattendue du serveur',
    detail: `Le serveur a répondu ${String(reponse.status)} sans décrire l'erreur.`,
    ...suite,
  })
}

/** Appelle l'API en HTTP : cookies de session, entrée validée avant l'envoi, sortie à la réception. */
export function creerTransportHttp({ base, fetchImpl = fetch }: OptionsTransportHttp): Transport {
  // La dernière version lue de chaque ressource : une écriture la renvoie dans `If-Match`, pour que
  // le serveur refuse (412) d'écraser ce qu'une autre fenêtre a changé entre-temps.
  const versions = new Map<string, string>()
  return {
    async appeler(route, entree, options) {
      const validee = validerEntree(route, entree)
      const enTetes = new Headers({ Accept: 'application/json, text/plain' })
      const corps = route.corps === undefined ? undefined : JSON.stringify(validee.corps)
      if (corps !== undefined) enTetes.set('Content-Type', 'application/json')

      const url = adresse(base, route, validee)
      const ressource = url.split('?')[0] ?? url
      const ecriture = route.methode !== 'GET'
      const version = versions.get(ressource)
      if (ecriture && version !== undefined) enTetes.set('If-Match', version)

      let reponse: Response
      try {
        reponse = await fetchImpl(url, {
          method: route.methode,
          headers: enTetes,
          credentials: 'include',
          ...(corps === undefined ? {} : { body: corps }),
          ...(options?.signal === undefined ? {} : { signal: options.signal }),
        })
      } catch (erreur) {
        // Une requête abandonnée n'est pas une panne : l'appelant la reconnaît à son nom.
        if (erreur instanceof DOMException && erreur.name === 'AbortError') throw erreur
        throw new ErreurReseau({ cause: erreur })
      }

      const etag = reponse.headers.get('ETag')
      if (reponse.ok && etag !== null) versions.set(ressource, etag)
      if (!reponse.ok) throw await erreurDeReponse(reponse)
      return validerSortie(route, route.reponse === null ? undefined : await lireCorps(reponse))
    },
  }
}
