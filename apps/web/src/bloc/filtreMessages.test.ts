import { EXEMPLES_PAGE } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { filtrerMessage } from './filtreMessages.ts'

const FENETRE = {}
const CONTEXTE = { fenetreFiche: FENETRE, bloc: 'D01', version: 3 }
const message = EXEMPLES_PAGE['etape.vue']

describe('filtrerMessage', () => {
  it('accepte un message valide de la fiche affichée', () => {
    expect(filtrerMessage({ source: FENETRE, data: message }, CONTEXTE)).toEqual({
      accepte: true,
      message,
    })
  })

  it('refuse un message d’une autre fenêtre', () => {
    expect(filtrerMessage({ source: {}, data: message }, CONTEXTE)).toEqual({
      accepte: false,
      refus: 'source_inconnue',
      pagePrete: false,
    })
  })

  it('refuse un message sans source', () => {
    expect(filtrerMessage({ source: null, data: message }, CONTEXTE)).toMatchObject({
      refus: 'source_inconnue',
    })
  })

  it('refuse tout quand la fiche n’a pas de fenêtre', () => {
    expect(
      filtrerMessage({ source: null, data: message }, { ...CONTEXTE, fenetreFiche: null }),
    ).toMatchObject({ refus: 'source_inconnue' })
  })

  it.each([
    ['du texte', 'bonjour'],
    ['un type inconnu', { ...message, type: 'autre' }],
    ['un champ en trop', { ...message, secret: 'x' }],
    ['un champ manquant', { ...message, etape: undefined }],
  ])('refuse %s (schéma)', (_nom, data) => {
    expect(filtrerMessage({ source: FENETRE, data }, CONTEXTE)).toEqual({
      accepte: false,
      refus: 'schema',
      pagePrete: false,
    })
  })

  it('refuse un autre bloc', () => {
    expect(
      filtrerMessage({ source: FENETRE, data: { ...message, bloc: 'D02' } }, CONTEXTE),
    ).toEqual({ accepte: false, refus: 'bloc', pagePrete: false })
  })

  it('accepte page.prete d’une fiche qui ne connaît pas encore son bloc', () => {
    const prete = { ...EXEMPLES_PAGE['page.prete'], bloc: 'D09' }

    expect(filtrerMessage({ source: FENETRE, data: prete }, CONTEXTE)).toMatchObject({
      accepte: true,
    })
  })

  it('signale un page.prete refusé pour son schéma ou sa version', () => {
    expect(
      filtrerMessage(
        { source: FENETRE, data: { ...EXEMPLES_PAGE['page.prete'], schema: 3 } },
        CONTEXTE,
      ),
    ).toEqual({ accepte: false, refus: 'schema', pagePrete: true })
    expect(
      filtrerMessage(
        { source: FENETRE, data: { ...EXEMPLES_PAGE['page.prete'], version: 9 } },
        CONTEXTE,
      ),
    ).toEqual({ accepte: false, refus: 'version', pagePrete: true })
  })

  it('refuse une autre version du manifeste', () => {
    expect(filtrerMessage({ source: FENETRE, data: { ...message, version: 2 } }, CONTEXTE)).toEqual(
      { accepte: false, refus: 'version', pagePrete: false },
    )
  })
})
