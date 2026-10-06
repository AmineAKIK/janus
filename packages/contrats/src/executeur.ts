import { z } from 'zod'

/** Ce que le Web Worker rend pour un cas : la sortie, ou l'erreur levée (`temps_depasse` incluse). */
export const ReponseCas = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), sortie: z.unknown() }),
  z.strictObject({ ok: z.literal(false), erreur: z.string() }),
])
export type ReponseCas = z.infer<typeof ReponseCas>

/** Le message que `executeur.html` renvoie à l'appli quand tous les cas sont passés. */
export const ResultatExecuteur = z.strictObject({
  type: z.literal('resultat'),
  id: z.string(),
  resultats: z.array(ReponseCas),
})
