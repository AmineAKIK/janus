import type { z } from 'zod'

/** Une route de l'API : ses schémas d'entrée (paramètres, requête, corps) et de sortie. */
export interface DefinitionRoute {
  readonly methode: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Le chemin, avec ses paramètres à la façon Fastify (`/blocs/:id`). */
  readonly chemin: string
  readonly params?: z.ZodType
  readonly requete?: z.ZodType
  readonly corps?: z.ZodType
  /** Le schéma de la réponse ; `null` pour une réponse sans corps (204). */
  readonly reponse: z.ZodType | null
  /** Le code HTTP du succès. */
  readonly succes: 200 | 201 | 204
}
