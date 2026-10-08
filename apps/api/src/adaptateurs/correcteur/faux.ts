import { corrigerSimule } from '@janus/contrats'
import type { Correcteur, RequeteCorrection, ResultatBrut } from './correcteur.ts'
import { ErreurCorrecteur } from './correcteur.ts'

/** Ce qui complète le message simulé pour qu'il ait la longueur d'une vraie correction (150 à 1500 caractères). */
const COMPLEMENT =
  ' Ce retour vient du correcteur simulé, qui compare seulement ta réponse à l’attendu : il sert aux tests et à la démonstration, pas à juger ce que tu as vraiment compris du cours.'

/** Le texte JSON que rend le correcteur simulé, selon les règles de la démo. */
function jsonSimule(requete: RequeteCorrection): string {
  const correction = corrigerSimule(requete.reponse, requete.attendu)
  return JSON.stringify({
    message: `${correction.message}${correction.refusee ? '' : (correction.indice ?? '')}${COMPLEMENT}`,
    niveau: correction.refusee ? 'pas_encore' : correction.niveau,
    erreurs_critiques: [],
    source: 'deduit',
    ref: '',
    certitude: 'sur',
  })
}

/** Ce que le scénario d'un test peut rendre à la place du JSON simulé : un texte brut, ou une panne. */
export type Scenario = (requete: RequeteCorrection, appel: number) => string | Error | undefined

export interface FauxCorrecteur extends Correcteur {
  /** Les requêtes reçues, dans l'ordre. */
  readonly requetes: readonly RequeteCorrection[]
}

/**
 * Le correcteur des tests et de la CI : les règles du correcteur simulé de la démo, sans réseau.
 * Un `scenario` peut rendre un texte (même invalide) ou une erreur pour un appel donné ; `undefined`
 * laisse la règle habituelle.
 */
export function creerFaux(scenario?: Scenario): FauxCorrecteur {
  const requetes: RequeteCorrection[] = []
  return {
    requetes,
    corriger: (requete) => {
      requetes.push(requete)
      const prevu = scenario?.(requete, requetes.length)
      if (prevu instanceof Error) {
        return Promise.reject(new ErreurCorrecteur(prevu.message, { cause: prevu }))
      }
      const resultat: ResultatBrut = {
        texte: prevu ?? jsonSimule(requete),
        modele: 'faux',
        parametres: {},
        jetonsEntree: 1000,
        jetonsEntreeCache: 0,
        jetonsSortie: 200,
      }
      return Promise.resolve(resultat)
    },
  }
}
