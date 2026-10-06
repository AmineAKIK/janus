import { describe, expect, it } from 'vitest'
import {
  blocDeEntree,
  derniereReponseGardee,
  etatIndicateur,
  reponsesGardees,
  textesEnvoi,
} from './indicateur.ts'
import type { EntreeEnvoi } from './stockageEnvoi.ts'

const entree = (extra: Partial<EntreeEnvoi>): EntreeEnvoi => ({
  id: 'x',
  route: 'POST /evenements',
  corps: { bloc: 'B03' },
  cree_le: '2026-10-06T08:00:00.000Z',
  ordre: 1,
  essais: 0,
  ...extra,
})

describe('textesEnvoi', () => {
  it('accorde « réponse gardée »', () => {
    expect(textesEnvoi(1)).toBe('En attente de réseau · 1 réponse gardée')
    expect(textesEnvoi(3)).toBe('En attente de réseau · 3 réponses gardées')
  })
})

describe('blocDeEntree', () => {
  it('lit le bloc du paramètre d’URL ou du message', () => {
    expect(blocDeEntree(entree({}))).toBe('B03')
    expect(
      blocDeEntree(entree({ route: 'PUT /blocs/:id/etat-page', params: { id: 'B04' }, corps: {} })),
    ).toBe('B04')
    expect(blocDeEntree(entree({ corps: 'x' }))).toBeNull()
  })
})

describe('reponsesGardees', () => {
  it('ne compte ni l’état de la page ni les autres blocs', () => {
    const entrees = [
      entree({ id: 'a' }),
      entree({ id: 'b', route: 'PUT /blocs/:id/etat-page', params: { id: 'B03' } }),
      entree({ id: 'c', corps: { bloc: 'B04' } }),
    ]

    expect(reponsesGardees(entrees, 'B03').map(({ id }) => id)).toEqual(['a'])
  })
})

describe('etatIndicateur', () => {
  it('attend le réseau quand des réponses sont gardées et que le réseau manque', () => {
    expect(
      etatIndicateur({ reseauManque: true, gardees: 3, enAttente: 4, precedent: 'enregistre' }),
    ).toBe('attente')
  })

  it('est enregistré quand rien n’attend', () => {
    expect(
      etatIndicateur({ reseauManque: false, gardees: 0, enAttente: 0, precedent: 'attente' }),
    ).toBe('enregistre')
  })

  it('garde son état précédent pendant un envoi en ligne', () => {
    expect(
      etatIndicateur({ reseauManque: false, gardees: 2, enAttente: 2, precedent: 'attente' }),
    ).toBe('attente')
    expect(
      etatIndicateur({ reseauManque: false, gardees: 1, enAttente: 1, precedent: 'enregistre' }),
    ).toBe('enregistre')
  })
})

describe('derniereReponseGardee', () => {
  it('rend la dernière demande de correction gardée', () => {
    const entrees = [
      entree({ id: 'a', route: 'POST /corrections', corps: { bloc: 'B03', reponse: 'Première' } }),
      entree({ id: 'b', route: 'POST /corrections', corps: { bloc: 'B03', reponse: 'Seconde' } }),
    ]

    expect(derniereReponseGardee(entrees, 'B03')).toBe('Seconde')
    expect(derniereReponseGardee(entrees, 'B04')).toBeNull()
  })
})
