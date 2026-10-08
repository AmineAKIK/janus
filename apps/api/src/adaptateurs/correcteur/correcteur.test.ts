import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { coutMillioniemes } from './cout.ts'
import { ErreurCorrecteur } from './correcteur.ts'
import type { RequeteCorrection } from './correcteur.ts'
import { creerDeepseek } from './deepseek.ts'
import type { ReglagesDeepseek } from './deepseek.ts'
import { creerFaux } from './faux.ts'
import { CONSIGNE, EMPREINTE_CONSIGNE, messagesDeLaRequete, RAPPEL_JSON } from './message.ts'

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

const REGLAGES: ReglagesDeepseek = {
  cle: 'sk-test',
  url: 'https://api.test/',
  modele: 'deepseek-flash',
  temperature: 0.2,
  delaiMs: 30_000,
  jetonsSortieMax: 1500,
}

describe('la consigne', () => {
  it('est le fichier prompts/correction/v1.md, avec son empreinte SHA-256', () => {
    const fichier = readFileSync(
      new URL('../../../../../prompts/correction/v1.md', import.meta.url),
      'utf8',
    )

    expect(CONSIGNE).toBe(fichier)
    expect(EMPREINTE_CONSIGNE).toBe(createHash('sha256').update(fichier).digest('hex'))
    expect(CONSIGNE.startsWith("Tu es le tuteur d'un apprenant débutant")).toBe(true)
    expect(CONSIGNE).toContain('Réponds uniquement avec ce JSON')
  })
})

describe('messagesDeLaRequete', () => {
  it('range la consigne, puis le contexte, la question, l’attendu et la réponse entre délimiteurs', () => {
    const [consigne, utilisateur, ...reste] = messagesDeLaRequete(REQUETE)

    expect(reste).toEqual([])
    expect(consigne).toEqual({ role: 'system', content: CONSIGNE })
    expect(utilisateur?.role).toBe('user')
    expect(utilisateur?.content).toBe(
      [
        'Bloc : Bloc de démonstration',
        'Cours du bloc :',
        'Une fiche résume un seul bloc de cours.',
        'Sources : S1 : cours §1',
        'Erreurs critiques de ce bloc : E1 : Confond fiche et cours',
        '',
        'Question : Qu’est-ce qu’une fiche ?',
        'Attendu (appui, pas barème) : Une fiche résume un seul bloc de cours avec ses exercices.',
        'Confiance annoncée : sur',
        '<reponse>',
        'Une fiche résume un seul bloc de cours avec ses exercices pratiques.',
        '</reponse>',
      ].join('\n'),
    )
  })

  it('coupe la réponse à 2000 caractères', () => {
    const [, utilisateur] = messagesDeLaRequete({ ...REQUETE, reponse: 'x'.repeat(2500) })

    expect(utilisateur?.content).toContain(`<reponse>\n${'x'.repeat(2000)}\n</reponse>`)
  })

  it('rejoue l’historique d’une relance : réponses de l’apprenant et du tuteur, la dernière à la fin', () => {
    const messages = messagesDeLaRequete({
      ...REQUETE,
      reponse: 'troisième',
      historique: [
        { reponse: 'première', message: 'retour 1' },
        { reponse: 'deuxième', message: 'retour 2' },
      ],
    })

    expect(messages.map(({ role }) => role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ])
    expect(messages[1]?.content).toContain('<reponse>\npremière\n</reponse>')
    expect(messages[2]?.content).toBe('retour 1')
    expect(messages[3]?.content).toBe('<reponse>\ndeuxième\n</reponse>')
    expect(messages[5]?.content).toBe('<reponse>\ntroisième\n</reponse>')
  })

  it('ajoute le rappel du JSON au second essai', () => {
    const messages = messagesDeLaRequete({ ...REQUETE, strict: true })

    expect(messages.at(-1)).toEqual({ role: 'user', content: RAPPEL_JSON })
    expect(RAPPEL_JSON).toContain('Réponds uniquement avec le JSON demandé')
  })
})

describe('coutMillioniemes', () => {
  const tarifs = { entreeCache: 6_000, entree: 300_000, sortie: 1_200_000 }

  it('facture le cache, le reste de l’entrée et la sortie à leurs tarifs', () => {
    expect(
      coutMillioniemes(
        { jetonsEntree: 1_000_000, jetonsEntreeCache: 400_000, jetonsSortie: 100_000 },
        tarifs,
      ),
    ).toBe(Math.ceil(2_400 + 180_000 + 120_000))
  })

  it('arrondit au-dessus, jamais moins que le coût réel', () => {
    expect(
      coutMillioniemes({ jetonsEntree: 1, jetonsEntreeCache: 0, jetonsSortie: 0 }, tarifs),
    ).toBe(1)
    expect(
      coutMillioniemes({ jetonsEntree: 0, jetonsEntreeCache: 0, jetonsSortie: 0 }, tarifs),
    ).toBe(0)
  })

  it('ne rend jamais de négatif si le cache dépasse l’entrée annoncée', () => {
    expect(
      coutMillioniemes({ jetonsEntree: 10, jetonsEntreeCache: 50, jetonsSortie: 0 }, tarifs),
    ).toBeGreaterThanOrEqual(0)
  })
})

describe('creerDeepseek', () => {
  const reponseOk = (surcharge: Record<string, unknown> = {}) =>
    Response.json({
      choices: [{ message: { content: '{"niveau":"solide"}' } }],
      usage: { prompt_tokens: 900, completion_tokens: 120, prompt_cache_hit_tokens: 600 },
      ...surcharge,
    })

  it('appelle /chat/completions en mode JSON avec le modèle et la température configurés', async () => {
    let vue: { url: string; init: RequestInit } | undefined
    const correcteur = creerDeepseek(REGLAGES, (url, init) => {
      vue = { url, init }
      return Promise.resolve(reponseOk())
    })

    const brut = await correcteur.corriger(REQUETE)

    expect(vue?.url).toBe('https://api.test/chat/completions')
    expect(vue?.init.method).toBe('POST')
    expect(vue?.init.headers).toMatchObject({ authorization: 'Bearer sk-test' })
    const corps: unknown = JSON.parse(typeof vue?.init.body === 'string' ? vue.init.body : '')
    expect(corps).toMatchObject({
      model: 'deepseek-flash',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1500,
    })
    expect(brut).toEqual({
      texte: '{"niveau":"solide"}',
      modele: 'deepseek-flash',
      parametres: { temperature: 0.2, max_tokens: 1500, response_format: 'json_object' },
      jetonsEntree: 900,
      jetonsEntreeCache: 600,
      jetonsSortie: 120,
    })
  })

  it('compte zéro jeton en cache quand le fournisseur ne le dit pas', async () => {
    const correcteur = creerDeepseek(REGLAGES, () =>
      Promise.resolve(reponseOk({ usage: { prompt_tokens: 10, completion_tokens: 5 } })),
    )

    expect((await correcteur.corriger(REQUETE)).jetonsEntreeCache).toBe(0)
  })

  it.each([
    ['un statut d’erreur', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['un réseau en panne', () => Promise.reject(new Error('ECONNRESET'))],
    ['un corps illisible', () => Promise.resolve(new Response('pas du json'))],
    [
      'un contenu vide',
      () => Promise.resolve(reponseOk({ choices: [{ message: { content: '' } }] })),
    ],
    [
      'un contenu absent',
      () => Promise.resolve(reponseOk({ choices: [{ message: { content: null } }] })),
    ],
  ])('lève ErreurCorrecteur sur %s', async (_nom, appel) => {
    const correcteur = creerDeepseek(REGLAGES, appel)

    await expect(correcteur.corriger(REQUETE)).rejects.toBeInstanceOf(ErreurCorrecteur)
  })
})

describe('creerFaux', () => {
  const lire = async (reponse: string, attendu = REQUETE.attendu) => {
    const faux = creerFaux()
    const brut = await faux.corriger({ ...REQUETE, reponse, attendu })
    return z_json(brut.texte)
  }
  const z_json = (texte: string): { message: string; niveau: string } =>
    JSON.parse(texte) as { message: string; niveau: string }

  it('suit les règles du correcteur simulé de la démo', async () => {
    expect((await lire('je ne sais pas')).niveau).toBe('pas_encore')
    expect((await lire('trop court')).niveau).toBe('fragile')
    expect((await lire(REQUETE.reponse)).niveau).toBe('solide')
    expect(
      (await lire('Un texte assez long mais qui parle de tout autre chose que du sujet.')).niveau,
    ).toBe('partiel')
  })

  it('rend un message de 150 à 1500 caractères, sans « acquis » ni « validé »', async () => {
    for (const reponse of ['je ne sais pas', 'trop court', REQUETE.reponse, ' ']) {
      const { message } = await lire(reponse)

      expect(message.length).toBeGreaterThanOrEqual(150)
      expect(message.length).toBeLessThanOrEqual(1500)
      expect(message).not.toMatch(/acquis|validé/iu)
    }
  })

  it('note les requêtes reçues et suit un scénario : texte invalide ou panne', async () => {
    const faux = creerFaux((_requete, appel) =>
      appel === 1 ? 'pas du json' : appel === 2 ? new Error('en panne') : undefined,
    )

    expect((await faux.corriger(REQUETE)).texte).toBe('pas du json')
    await expect(faux.corriger(REQUETE)).rejects.toBeInstanceOf(ErreurCorrecteur)
    expect((await faux.corriger(REQUETE)).modele).toBe('faux')
    expect(faux.requetes).toHaveLength(3)
  })
})
