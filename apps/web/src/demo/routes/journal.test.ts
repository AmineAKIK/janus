import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ErreurApi, nouvelId, ROUTES, TypeJournal } from '@janus/contrats'
import { TYPES_JOURNAL } from '@janus/moteur'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'

const lire = (banc: ReturnType<typeof monterDemo>, requete = {}) =>
  banc.transport.appeler(ROUTES['GET /journal'], { requete })

describe('journal de la démo, avec la graine', () => {
  it('garde les mêmes types que le contrat, dans le même ordre', () => {
    expect([...TYPES_JOURNAL]).toEqual(TypeJournal.options)
  })

  it('rend les lignes les plus récentes d’abord, 50 par page, et l’état des 20 blocs', async () => {
    const vue = await lire(monterDemo())

    expect(vue.modules.map(({ id }) => id)).toEqual(['M1'])
    expect(vue.blocs).toHaveLength(20)
    expect(vue.entrees.length).toBeGreaterThan(0)
    expect(vue.entrees.length).toBeLessThanOrEqual(50)
    const dates = vue.entrees.map(({ date }) => Date.parse(date))
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
  })

  it('suit les pages jusqu’au bout sans trou ni doublon', async () => {
    const banc = monterDemo()
    const ids: string[] = []
    let avant: string | undefined
    for (let page = 0; page < 20; page += 1) {
      const vue = await lire(banc, avant === undefined ? {} : { avant })
      ids.push(...vue.entrees.map(({ id }) => id))
      if (vue.suivant === null) break
      avant = vue.suivant
    }

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('filtre par bloc et par type', async () => {
    const banc = monterDemo()
    const tout = await lire(banc)

    const b04 = await lire(banc, { bloc: 'B04' })
    expect(b04.entrees.length).toBeGreaterThan(0)
    expect(b04.entrees.every(({ bloc }) => bloc === 'B04')).toBe(true)

    const forces = await lire(banc, { type: 'verification' })
    expect(forces.entrees.every(({ type }) => type === 'verification')).toBe(true)
    expect(forces.entrees.length).toBeLessThan(tout.entrees.length)
  })

  it('un module inconnu garde tous les blocs, un module connu les limite à sa liste', async () => {
    const banc = monterDemo()

    expect((await lire(banc, { module: 'M1' })).entrees).toEqual((await lire(banc)).entrees)
    expect((await lire(banc, { module: 'M9' })).entrees).toEqual((await lire(banc)).entrees)
  })

  it('montre B07 ouvert sans prérequis, avec sa raison', async () => {
    const vue = await lire(monterDemo(), { bloc: 'B07', type: 'seance' })

    expect(vue.entrees.some(({ resume }) => resume.includes('ouvert sans les prérequis'))).toBe(
      true,
    )
  })
})

describe('contestations dans le journal de la démo', () => {
  const demanderCorrection = (
    banc: ReturnType<typeof monterDemo>,
    id: string,
    relance = '',
    conteste = false,
  ) =>
    banc.transport.appeler(ROUTES['POST /corrections'], {
      corps: {
        id,
        serie: 'restitution',
        tentative: 1,
        question: 'R1',
        reponse: 'Réponse attendue : Que contient une fiche . Et voilà mes propres mots.',
        confiance: 'sur',
        relance,
        support: { colle: false, retour_cours: false },
        bloc: 'B08',
        version: 1,
        ...(conteste ? { conteste: true } : {}),
      },
    })

  it('filtre une contestation et la marque en attente jusqu’au tranchage', async () => {
    const banc = monterDemo({ delaiCorrectionMs: 0 })
    const correction = await demanderCorrection(banc, nouvelId(30))
    await demanderCorrection(
      banc,
      nouvelId(31),
      'Je conteste ta correction : mon raisonnement suit bien le cours.',
      true,
    )

    const avant = await lire(banc, { type: 'contestation' })
    expect(avant.entrees).toHaveLength(1)
    expect(avant.entrees[0]).toMatchObject({
      bloc: 'B08',
      type: 'contestation',
      contestation_en_attente: true,
    })

    await banc.transport.appeler(ROUTES['POST /corrections/:id/trancher'], {
      params: { id: correction.id },
      corps: { id: nouvelId(32), compte: true },
    })

    const apres = await lire(banc, { type: 'contestation' })
    expect(apres.entrees[0]?.contestation_en_attente).toBe(false)
  })
})

describe('notes et idées du journal de la démo', () => {
  const ecrire = async (banc: ReturnType<typeof monterDemo>, entree: string, texte: string) => {
    const id = nouvelId(1)
    const note = await banc.transport.appeler(ROUTES['POST /journal/notes'], {
      corps: { id, entree, texte },
    })
    return { id, note }
  }

  it('ajoute une note sur une ligne, puis la modifie', async () => {
    const banc = monterDemo()
    const premiere = (await lire(banc)).entrees[0]
    const entree = premiere?.id ?? ''

    const { id, note } = await ecrire(banc, entree, 'Je comprends mieux.')
    expect(note).toMatchObject({ id, entree, texte: 'Je comprends mieux.' })
    expect((await lire(banc)).entrees[0]?.note?.texte).toBe('Je comprends mieux.')

    const modifiee = await banc.transport.appeler(ROUTES['PATCH /journal/notes/:id'], {
      params: { id },
      corps: { texte: 'Encore mieux.' },
    })
    expect(modifiee.texte).toBe('Encore mieux.')
    expect((await lire(banc)).entrees[0]?.note?.texte).toBe('Encore mieux.')
  })

  it('rend la même note quand le message est rejoué', async () => {
    const banc = monterDemo()
    const entree = (await lire(banc)).entrees[0]?.id ?? ''
    const { id, note } = await ecrire(banc, entree, 'Une fois.')

    const encore = await banc.transport.appeler(ROUTES['POST /journal/notes'], {
      corps: { id, entree, texte: 'Une fois.' },
    })

    expect(encore).toEqual(note)
  })

  it('refuse une ligne inconnue, une deuxième note sur la même ligne et une note inconnue', async () => {
    const banc = monterDemo()
    const entree = (await lire(banc)).entrees[0]?.id ?? ''
    await ecrire(banc, entree, 'La première.')

    await expect(ecrire(banc, 'inconnue', 'Rien.')).rejects.toMatchObject({ status: 404 })
    await expect(
      banc.transport.appeler(ROUTES['POST /journal/notes'], {
        corps: { id: nouvelId(2), entree, texte: 'La deuxième.' },
      }),
    ).rejects.toBeInstanceOf(ErreurApi)
    await expect(
      banc.transport.appeler(ROUTES['PATCH /journal/notes/:id'], {
        params: { id: nouvelId(3) },
        corps: { texte: 'Rien.' },
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('range les idées, la plus récente d’abord, sans doublon', async () => {
    const banc = monterDemo()
    const une = nouvelId(10)
    const envoyer = (id: string, texte: string) =>
      banc.transport.appeler(ROUTES['POST /journal/idees'], { corps: { id, texte } })

    await envoyer(une, 'Une.')
    await envoyer(nouvelId(11), 'Deux.')
    await envoyer(une, 'Une.')

    expect((await lire(banc)).idees.map(({ texte }) => texte)).toEqual(['Deux.', 'Une.'])
  })
})

describe('export texte du journal de la démo', () => {
  it('est identique octet pour octet à la fixture de la graine', async () => {
    const texte = await monterDemo().transport.appeler(ROUTES['GET /journal/export.txt'], {})
    const fixture = resolve(
      process.cwd(),
      '../../packages/moteur/src/journal/__fixtures__/export-graine.txt',
    )

    if (process.env['ECRIRE_FIXTURE'] === '1') writeFileSync(fixture, texte)
    expect(texte).toBe(readFileSync(fixture, 'utf8'))
  })

  it('ajoute les idées dans « À explorer plus tard »', async () => {
    const banc = monterDemo()
    await banc.transport.appeler(ROUTES['POST /journal/idees'], {
      corps: { id: nouvelId(20), texte: 'Un mode révision rapide.' },
    })

    const texte = await banc.transport.appeler(ROUTES['GET /journal/export.txt'], {})

    expect(texte).toContain('### À explorer plus tard\n\n- Un mode révision rapide.\n')
  })
})
