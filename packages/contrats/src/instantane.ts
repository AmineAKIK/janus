import { z } from 'zod'

/**
 * Les dernières données lues par l'appli, gardées sur l'appareil pour s'afficher sans réseau. Chaque
 * réponse est revalidée par le schéma de sa route avant d'être reprise : ce qui est gardé ici n'est
 * jamais cru sur parole.
 */
export const InstantaneDonnees = z.strictObject({
  version: z.literal(1),
  requetes: z.array(
    z.strictObject({
      /** La clé de la requête : le nom de la route, puis son entrée. */
      cle: z.tuple([z.string(), z.unknown()]),
      donnees: z.unknown(),
      /** L'instant de la lecture, en millisecondes. */
      mis_a_jour: z.number().int().nonnegative(),
    }),
  ),
})
export type InstantaneDonnees = z.infer<typeof InstantaneDonnees>
