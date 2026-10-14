import { Certitude, Niveau, Source } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { creerClaude, schemaSortie } from './claude.ts'
import type { ReglagesClaude } from './claude.ts'
import { ErreurCorrecteur } from './correcteur.ts'
import type { RequeteCorrection } from './correcteur.ts'
import { CONSIGNE, messagesDeLaRequete, RAPPEL_JSON } from './message.ts'

const REQUETE: RequeteCorrection = {
  titre: 'Bloc de démonstration',
  contexteIa: 'Une fiche résume un seul bloc de cours.',
  sources: [{ id: 'S1', ref: 'cours §1' }],
  erreursCritiques: [{ id: 'E1', texte: 'Confond fiche et cours' }],
  question: 'Qu’est-ce qu’une fiche ?',
  attendu: 'Une fiche résume un seul bloc de cours avec ses exercices.',
  confiance: 'sur',
  reponse: 'Une fiche résume un seul bloc de cours avec ses exercices pratiques.',
  historique: [],
  strict: false,
}

const REGLAGES: ReglagesClaude = {
  cle: 'sk-ant-test',
  url: 'https://api.test/',
  modele: 'claude-haiku-5-5',
  delaiMs: 30_000,
  jetonsSortieMax: 1000,
}

const reponseOk = (surcharge: Record<string, unknown> = {}) =>
  Response.json({
    id: 'msg_01',
    content: [{ type: 'text', text: '{"niveau":"solide"}' }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 300,
      output_tokens: 120,
      cache_read_input_tokens: 600,
      cache_creation_input_tokens: 0,
    },
    ...surcharge,
  })

interface Bloc {
  readonly type: string
  readonly text: string
  readonly cache_control?: unknown
}

interface Corps {
  readonly model: string
  readonly max_tokens: number
  readonly system: readonly Bloc[]
  readonly messages: readonly {
    readonly role: string
    readonly content: string | readonly Bloc[]
  }[]
  readonly thinking: unknown
  readonly output_config: unknown
  readonly temperature?: unknown
}

/** Appelle le correcteur et rend ce qui est parti sur le réseau, avec son corps décodé. */
async function appeler(requete: RequeteCorrection, reponse = reponseOk()) {
  let vue: { url: string; init: RequestInit } | undefined
  const correcteur = creerClaude(REGLAGES, (url, init) => {
    vue = { url, init }
    return Promise.resolve(reponse)
  })
  const brut = await correcteur.corriger(requete)
  if (vue === undefined) throw new Error('Aucun appel.')
  const corps = JSON.parse(typeof vue.init.body === 'string' ? vue.init.body : '') as Corps
  return { brut, vue, corps }
}

describe('creerClaude', () => {
  it('appelle /v1/messages : consigne en system, réflexion désactivée, JSON imposé, sans température', async () => {
    const { brut, vue, corps } = await appeler(REQUETE)

    expect(vue.url).toBe('https://api.test/v1/messages')
    expect(vue.init.method).toBe('POST')
    expect(vue.init.headers).toMatchObject({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
    })
    expect(corps.model).toBe('claude-haiku-5-5')
    expect(corps.max_tokens).toBe(1000)
    expect(corps.system).toEqual([
      { type: 'text', text: CONSIGNE, cache_control: { type: 'ephemeral' } },
    ])
    expect(corps.thinking).toEqual({ type: 'disabled' })
    expect(corps.output_config).toEqual({
      format: { type: 'json_schema', schema: schemaSortie(REQUETE) },
    })
    expect(corps).not.toHaveProperty('temperature')
    expect(corps.messages.map(({ role }) => role)).toEqual(['user'])
    expect(brut).toEqual({
      texte: '{"niveau":"solide"}',
      modele: 'claude-haiku-5-5',
      parametres: { thinking: 'disabled', max_tokens: 1000, format: 'json_schema' },
      jetonsEntree: 900,
      jetonsEntreeCache: 600,
      jetonsEntreeCacheEcrits: 0,
      jetonsSortie: 120,
    })
  })

  it('coupe le premier message en deux blocs, le contexte du bloc mémorisable, le même texte que pour DeepSeek', async () => {
    const { corps } = await appeler(REQUETE)
    const blocs = corps.messages[0]?.content
    if (typeof blocs === 'string') throw new Error('Un seul bloc.')

    expect(blocs?.map(({ type }) => type)).toEqual(['text', 'text'])
    expect(blocs?.[0]?.cache_control).toEqual({ type: 'ephemeral' })
    expect(blocs?.[0]?.text).toContain('Cours du bloc :')
    expect(blocs?.[0]?.text).not.toContain('<reponse>')
    expect(blocs?.[1]).not.toHaveProperty('cache_control')
    expect(blocs?.[1]?.text).toContain('<reponse>')
    expect(blocs?.map(({ text }) => text).join('')).toBe(messagesDeLaRequete(REQUETE)[1]?.content)
  })

  it('rejoue l’historique d’une relance et finit toujours par un message de l’apprenant', async () => {
    const { corps } = await appeler({
      ...REQUETE,
      reponse: 'deuxième',
      historique: [{ reponse: 'première', message: 'retour 1' }],
      strict: true,
    })

    expect(corps.messages.map(({ role }) => role)).toEqual(['user', 'assistant', 'user', 'user'])
    const premier = corps.messages[0]?.content
    if (typeof premier === 'string') throw new Error('Un seul bloc.')
    expect(premier?.[1]?.text).toContain('première')
    expect(corps.messages[1]?.content).toBe('retour 1')
    expect(corps.messages.at(-1)?.content).toBe(RAPPEL_JSON)
    expect(corps.system[0]?.text).toBe(CONSIGNE)
  })

  it('impose les champs exacts de la sortie, avec les valeurs des contrats', () => {
    const schema = schemaSortie(REQUETE)
    expect(schema.required).toEqual([
      'message',
      'niveau',
      'erreurs_critiques',
      'source',
      'ref',
      'certitude',
    ])
    expect(Object.keys(schema.properties)).toEqual([...schema.required])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.niveau.enum).toEqual(Niveau.options)
    expect(schema.properties.source.enum).toEqual(Source.options)
    expect(schema.properties.certitude.enum).toEqual(Certitude.options)
  })

  it('borne ref et erreurs_critiques aux identifiants du bloc, ref pouvant rester vide', () => {
    const schema = schemaSortie({
      sources: [
        { id: 'S1', ref: 'cours §1' },
        { id: 'S2', ref: 'cours §2' },
      ],
      erreursCritiques: [
        { id: 'E1', texte: 'a' },
        { id: 'E2', texte: 'b' },
      ],
    })
    expect(schema.properties.ref.enum).toEqual(['', 'S1', 'S2'])
    expect(schema.properties.erreurs_critiques.items).toEqual({
      type: 'string',
      enum: ['E1', 'E2'],
    })
  })

  it('laisse la liste des erreurs libre quand le bloc n’en déclare aucune (un enum vide est invalide)', () => {
    const schema = schemaSortie({ sources: [], erreursCritiques: [] })
    expect(schema.properties.ref.enum).toEqual([''])
    expect(schema.properties.erreurs_critiques.items).toEqual({ type: 'string' })
  })

  it('additionne les jetons hors cache, lus et écrits dans le cache ; zéro quand le fournisseur ne le dit pas', async () => {
    const avec = await appeler(
      REQUETE,
      reponseOk({
        usage: {
          input_tokens: 100,
          output_tokens: 5,
          cache_read_input_tokens: 40,
          cache_creation_input_tokens: 60,
        },
      }),
    )
    const sans = await appeler(
      REQUETE,
      reponseOk({ usage: { input_tokens: 10, output_tokens: 5 } }),
    )

    expect(avec.brut).toMatchObject({
      jetonsEntree: 200,
      jetonsEntreeCache: 40,
      jetonsEntreeCacheEcrits: 60,
      jetonsSortie: 5,
    })
    expect(sans.brut).toMatchObject({
      jetonsEntree: 10,
      jetonsEntreeCache: 0,
      jetonsEntreeCacheEcrits: 0,
    })
  })

  it('assemble les blocs de texte et ignore les autres', async () => {
    const { brut } = await appeler(
      REQUETE,
      reponseOk({
        content: [
          { type: 'thinking', thinking: '', signature: 'x' },
          { type: 'text', text: '{"niveau":' },
          { type: 'text', text: '"partiel"}' },
        ],
      }),
    )

    expect(brut.texte).toBe('{"niveau":"partiel"}')
  })

  it.each([
    ['un statut d’erreur', () => Promise.resolve(new Response('{}', { status: 529 }))],
    ['un réseau en panne', () => Promise.reject(new Error('ECONNRESET'))],
    ['un corps illisible', () => Promise.resolve(new Response('pas du json'))],
    ['aucun bloc de texte', () => Promise.resolve(reponseOk({ content: [] }))],
    ['un texte vide', () => Promise.resolve(reponseOk({ content: [{ type: 'text', text: '' }] }))],
    ['un refus', () => Promise.resolve(reponseOk({ stop_reason: 'refusal' }))],
  ])('lève ErreurCorrecteur sur %s', async (_nom, appel) => {
    const correcteur = creerClaude(REGLAGES, appel)

    await expect(correcteur.corriger(REQUETE)).rejects.toBeInstanceOf(ErreurCorrecteur)
  })
})
