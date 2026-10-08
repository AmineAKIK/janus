import { z } from 'zod'
import { ErreurCorrecteur } from './correcteur.ts'
import type { Correcteur, ResultatBrut } from './correcteur.ts'
import { messagesDeLaRequete } from './message.ts'

/** Les réglages du fournisseur : jamais écrits dans le code, ils viennent de la configuration. */
export interface ReglagesDeepseek {
  readonly cle: string
  readonly url: string
  readonly modele: string
  readonly temperature: number
  readonly delaiMs: number
  /** Assez grand pour que le JSON ne soit pas coupé en route. */
  readonly jetonsSortieMax: number
}

const Reponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().min(0),
    completion_tokens: z.number().int().min(0),
    prompt_cache_hit_tokens: z.number().int().min(0).optional(),
  }),
})

/** L'appel HTTP, injecté dans les tests. */
export type AppelHttp = (url: string, init: RequestInit) => Promise<Response>

/** L'API compatible OpenAI de DeepSeek, en mode JSON. */
export function creerDeepseek(
  reglages: ReglagesDeepseek,
  appel: AppelHttp = (url, init) => fetch(url, init),
): Correcteur {
  return {
    async corriger(requete): Promise<ResultatBrut> {
      let reponse: Response
      try {
        reponse = await appel(`${reglages.url.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${reglages.cle}`,
          },
          body: JSON.stringify({
            model: reglages.modele,
            messages: messagesDeLaRequete(requete),
            response_format: { type: 'json_object' },
            temperature: reglages.temperature,
            max_tokens: reglages.jetonsSortieMax,
          }),
          signal: AbortSignal.timeout(reglages.delaiMs),
        })
      } catch (cause) {
        throw new ErreurCorrecteur('DeepSeek ne répond pas.', { cause })
      }
      if (!reponse.ok) throw new ErreurCorrecteur(`DeepSeek a répondu ${String(reponse.status)}.`)
      const lu = Reponse.safeParse(await reponse.json().catch(() => undefined))
      const contenu = lu.data?.choices[0]?.message.content
      if (!lu.success || contenu === null || contenu === undefined || contenu === '') {
        throw new ErreurCorrecteur('DeepSeek a rendu une réponse vide ou illisible.')
      }
      return {
        texte: contenu,
        modele: reglages.modele,
        parametres: {
          temperature: reglages.temperature,
          max_tokens: reglages.jetonsSortieMax,
          response_format: 'json_object',
        },
        jetonsEntree: lu.data.usage.prompt_tokens,
        jetonsEntreeCache: lu.data.usage.prompt_cache_hit_tokens ?? 0,
        jetonsSortie: lu.data.usage.completion_tokens,
      }
    },
  }
}
