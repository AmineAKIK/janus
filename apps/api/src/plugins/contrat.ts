import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../erreurs.ts'

/** Le schéma Fastify d'une route du contrat : entrée validée, sortie filtrée. */
export function schemaDe(definition: DefinitionRoute) {
  return {
    ...(definition.params === undefined ? {} : { params: definition.params }),
    ...(definition.requete === undefined ? {} : { querystring: definition.requete }),
    ...(definition.corps === undefined ? {} : { body: definition.corps }),
    ...(definition.reponse === null
      ? {}
      : { response: { [definition.succes]: definition.reponse } }),
  }
}

/** L'utilisateur de la session ; sans session, la requête est refusée. */
export function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}
