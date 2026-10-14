import { Certitude, Niveau, Source } from '@janus/contrats'
import { z } from 'zod'
import { ErreurCorrecteur } from './correcteur.ts'
import type { Correcteur, RequeteCorrection, ResultatBrut } from './correcteur.ts'
import type { AppelHttp } from './deepseek.ts'
import { messagesDeLaRequete } from './message.ts'

/** Les réglages du fournisseur : jamais écrits dans le code, ils viennent de la configuration. */
export interface ReglagesClaude {
  readonly cle: string
  readonly url: string
  readonly modele: string
  readonly delaiMs: number
  /** Assez grand pour que le JSON ne soit pas coupé en route. */
  readonly jetonsSortieMax: number
}

/** La version de l'API Messages (l'en-tête `anthropic-version`). */
const VERSION_API = '2023-06-01'

/**
 * Le JSON que le correcteur doit rendre, imposé au modèle (sortie structurée) : les mêmes champs
 * que `validerSortie`, qui reste juge du message (longueur, mots de statut) et du couple
 * source/ref. `ref` et `erreurs_critiques` sont bornés aux identifiants du bloc : le modèle ne peut
 * plus en inventer. L'API n'accepte ni longueur minimale ni maximale dans le schéma.
 */
export function schemaSortie(requete: Pick<RequeteCorrection, 'sources' | 'erreursCritiques'>) {
  const erreurs = requete.erreursCritiques.map(({ id }) => id)
  return {
    type: 'object',
    properties: {
      message: { type: 'string' },
      niveau: { type: 'string', enum: Niveau.options },
      // Un `enum` vide est invalide : sans erreur critique, la liste reste libre et `validerSortie` écarte ce qui est inconnu.
      erreurs_critiques: {
        type: 'array',
        items: erreurs.length === 0 ? { type: 'string' } : { type: 'string', enum: erreurs },
      },
      source: { type: 'string', enum: Source.options },
      ref: { type: 'string', enum: ['', ...requete.sources.map(({ id }) => id)] },
      certitude: { type: 'string', enum: Certitude.options },
    },
    required: ['message', 'niveau', 'erreurs_critiques', 'source', 'ref', 'certitude'],
    additionalProperties: false,
  } as const
}

const Reponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    cache_read_input_tokens: z.number().int().min(0).nullable().optional(),
    cache_creation_input_tokens: z.number().int().min(0).nullable().optional(),
  }),
})

/**
 * L'API Messages de Claude : la consigne en `system`, la réflexion désactivée, le JSON imposé par un
 * schéma. Pas de température : Haiku 5.5 n'en accepte pas d'autre que la sienne. Pas de cache
 * demandé ; comme `input_tokens` ne compte pas les jetons lus ou écrits dans le cache, on les
 * additionne pour ne jamais sous-compter.
 */
export function creerClaude(
  reglages: ReglagesClaude,
  appel: AppelHttp = (url, init) => fetch(url, init),
): Correcteur {
  return {
    async corriger(requete): Promise<ResultatBrut> {
      const tous = messagesDeLaRequete(requete)
      const consigne = tous.find(({ role }) => role === 'system')?.content ?? ''
      const messages = tous
        .filter(({ role }) => role !== 'system')
        .map(({ role, content }) => ({ role, content }))
      let reponse: Response
      try {
        reponse = await appel(`${reglages.url.replace(/\/$/, '')}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': reglages.cle,
            'anthropic-version': VERSION_API,
          },
          body: JSON.stringify({
            model: reglages.modele,
            max_tokens: reglages.jetonsSortieMax,
            system: consigne,
            messages,
            thinking: { type: 'disabled' },
            output_config: { format: { type: 'json_schema', schema: schemaSortie(requete) } },
          }),
          signal: AbortSignal.timeout(reglages.delaiMs),
        })
      } catch (cause) {
        throw new ErreurCorrecteur('Claude ne répond pas.', { cause })
      }
      if (!reponse.ok) throw new ErreurCorrecteur(`Claude a répondu ${String(reponse.status)}.`)
      const lu = Reponse.safeParse(await reponse.json().catch(() => undefined))
      if (!lu.success) throw new ErreurCorrecteur('Claude a rendu une réponse illisible.')
      if (lu.data.stop_reason === 'refusal') {
        throw new ErreurCorrecteur('Claude a refusé de corriger cette réponse.')
      }
      const texte = lu.data.content
        .filter(({ type }) => type === 'text')
        .map(({ text }) => text ?? '')
        .join('')
      if (texte === '') throw new ErreurCorrecteur('Claude a rendu une réponse vide.')
      const { usage } = lu.data
      const lus = usage.cache_read_input_tokens ?? 0
      const ecrits = usage.cache_creation_input_tokens ?? 0
      return {
        texte,
        modele: reglages.modele,
        parametres: {
          thinking: 'disabled',
          max_tokens: reglages.jetonsSortieMax,
          format: 'json_schema',
        },
        jetonsEntree: usage.input_tokens + lus + ecrits,
        jetonsEntreeCache: lus,
        jetonsSortie: usage.output_tokens,
      }
    },
  }
}
