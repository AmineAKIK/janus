/** Un paramètre de recherche facultatif : une chaîne non vide, sinon absent. */
function texte(valeur: unknown): string | undefined {
  return typeof valeur === 'string' && valeur !== '' ? valeur : undefined
}

export interface RechercheModule {
  readonly statut?: string
  readonly detail?: string
}

export interface RechercheJournal {
  readonly module?: string
  readonly bloc?: string
  readonly type?: string
}

export function validerRechercheModule(brut: Record<string, unknown>): RechercheModule {
  const statut = texte(brut['statut'])
  const detail = texte(brut['detail'])
  return {
    ...(statut === undefined ? {} : { statut }),
    ...(detail === undefined ? {} : { detail }),
  }
}

export function validerRechercheJournal(brut: Record<string, unknown>): RechercheJournal {
  const module = texte(brut['module'])
  const bloc = texte(brut['bloc'])
  const type = texte(brut['type'])
  return {
    ...(module === undefined ? {} : { module }),
    ...(bloc === undefined ? {} : { bloc }),
    ...(type === undefined ? {} : { type }),
  }
}

export interface RechercheConnexion {
  readonly retour?: string
}

/** L'adresse à retrouver après la connexion : un chemin de l'appli, jamais un autre site. */
export function validerRechercheConnexion(brut: Record<string, unknown>): RechercheConnexion {
  const retour = texte(brut['retour'])
  return retour?.startsWith('/') === true && !retour.startsWith('//') ? { retour } : {}
}

export interface RechercheSuivi {
  readonly module?: string
  readonly periode?: string
}

export function validerRechercheSuivi(brut: Record<string, unknown>): RechercheSuivi {
  const module = texte(brut['module'])
  const periode = texte(brut['periode'])
  return {
    ...(module === undefined ? {} : { module }),
    ...(periode === undefined ? {} : { periode }),
  }
}
