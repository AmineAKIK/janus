import { describe, expect, it } from 'vitest'
import { SchemaConfigCorrecteur } from '../../config.ts'
import { correcteurDeLaConfig } from './choix.ts'
import type { RequeteCorrection } from './correcteur.ts'

const LIMITES = { delaiMs: 30_000, jetonsSortieMax: 1000 }

const REQUETE: RequeteCorrection = {
  titre: 'Bloc',
  contexteIa: 'Cours.',
  sources: [],
  erreursCritiques: [],
  question: 'Question ?',
  attendu: 'Attendu.',
  confiance: 'sur',
  reponse: 'Réponse.',
  historique: [],
  strict: false,
}

/** Rend l'adresse appelée par le correcteur, avec une réponse que les deux fournisseurs acceptent. */
async function adresseAppelee(
  correcteur: NonNullable<ReturnType<typeof correcteurDeLaConfig>['correcteur']>,
  appels: string[],
) {
  await correcteur.corriger(REQUETE)
  return appels
}

const reponseDeepseek = () =>
  Response.json({
    choices: [{ message: { content: '{}' } }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  })
const reponseClaude = () =>
  Response.json({
    content: [{ type: 'text', text: '{}' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  })

describe('correcteurDeLaConfig', () => {
  it('prend DeepSeek par défaut, avec ses tarifs et son modèle', async () => {
    const config = SchemaConfigCorrecteur.parse({ DEEPSEEK_API_KEY: 'sk-deepseek' })
    const appels: string[] = []
    const choix = correcteurDeLaConfig(config, LIMITES, (url) => {
      appels.push(url)
      return Promise.resolve(reponseDeepseek())
    })

    expect(config.CORRECTEUR).toBe('deepseek')
    expect(choix.modele).toBe('deepseek-flash')
    expect(choix.tarifs).toEqual({ entreeCache: 6_000, entree: 300_000, sortie: 1_200_000 })
    if (choix.correcteur === undefined) throw new Error('Pas de correcteur.')
    expect(await adresseAppelee(choix.correcteur, appels)).toEqual([
      'https://api.deepseek.com/chat/completions',
    ])
  })

  it('prend Claude quand CORRECTEUR=claude, avec ses tarifs et son modèle', async () => {
    const config = SchemaConfigCorrecteur.parse({
      CORRECTEUR: 'claude',
      ANTHROPIC_API_KEY: 'sk-ant',
      DEEPSEEK_API_KEY: 'sk-deepseek',
    })
    const appels: string[] = []
    const choix = correcteurDeLaConfig(config, LIMITES, (url) => {
      appels.push(url)
      return Promise.resolve(reponseClaude())
    })

    expect(choix.modele).toBe('claude-haiku-5-5')
    expect(choix.tarifs).toEqual({ entreeCache: 10_000, entree: 100_000, sortie: 500_000 })
    if (choix.correcteur === undefined) throw new Error('Pas de correcteur.')
    expect(await adresseAppelee(choix.correcteur, appels)).toEqual([
      'https://api.anthropic.com/v1/messages',
    ])
  })

  it('sans la clé du fournisseur choisi, pas de correcteur, même si l’autre clé est là', () => {
    const claude = correcteurDeLaConfig(
      SchemaConfigCorrecteur.parse({ CORRECTEUR: 'claude', DEEPSEEK_API_KEY: 'sk-deepseek' }),
      LIMITES,
    )
    const deepseek = correcteurDeLaConfig(
      SchemaConfigCorrecteur.parse({ ANTHROPIC_API_KEY: 'sk-ant' }),
      LIMITES,
    )

    expect(claude.correcteur).toBeUndefined()
    expect(claude.modele).toBe('claude-haiku-5-5')
    expect(deepseek.correcteur).toBeUndefined()
    expect(deepseek.modele).toBe('deepseek-flash')
  })
})
