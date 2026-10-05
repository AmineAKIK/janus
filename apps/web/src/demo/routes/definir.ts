import { lireEntree } from '@janus/contrats'
import type { DefinitionRoute, EntreeLue, SortieRoute } from '@janus/contrats'
import type { HorlogeDemo } from '../horlogeDemo.ts'
import type { Magasin } from '../store.ts'
import type { ContexteRoute, RouteDemo } from '../transportDemo.ts'

/** Ce qu'une route reçoit, typé par les schémas de sa définition. */
export interface Appel<D extends DefinitionRoute> extends EntreeLue<D> {
  readonly magasin: Magasin
  readonly horloge: HorlogeDemo
}

/**
 * Une route de démo typée : la fonction reçoit l'entrée validée avec le type des schémas de la route,
 * et doit rendre exactement ce que la route annonce.
 */
export function definir<D extends DefinitionRoute>(
  definition: D,
  repondre: (appel: Appel<D>) => SortieRoute<D>,
): readonly [string, RouteDemo] {
  const cle = `${definition.methode} ${definition.chemin}`
  const route = ({ magasin, horloge, entree }: ContexteRoute): unknown =>
    repondre({ magasin, horloge, ...lireEntree(definition, entree) })
  return [cle, route]
}
