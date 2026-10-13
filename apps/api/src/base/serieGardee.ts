import { z } from 'zod'

/** La série de questions de début de séance, telle que `series_questions_debut` la garde. */
export const SerieGardee = z.array(z.strictObject({ bloc: z.string(), question: z.string() }))
