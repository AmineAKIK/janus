import { describe, expect, expectTypeOf, it } from 'vitest'
import { ROUTES } from './api/index.ts'
import {
  ErreurApi,
  ErreurDonnees,
  nomRoute,
  remplirChemin,
  lireEntree,
  validerEntree,
  validerSortie,
} from './transport.ts'
import type { EntreeRoute, SortieRoute, Transport } from './transport.ts'

const CONNEXION = ROUTES['POST /session']
const MOI = ROUTES['GET /moi']
const BLOC = ROUTES['GET /blocs/:id']
const SUPPRIMER = ROUTES['DELETE /session']

const UTILISATEUR = {
  id: '0190a000-0000-7000-8000-000000000001',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
}

describe('types des routes', () => {
  it("l'entrée suit les schémas de la route", () => {
    const connexion: EntreeRoute<typeof CONNEXION> = {
      corps: { nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' },
    }
    // @ts-expect-error le corps est obligatoire pour cette route
    const sansCorps: EntreeRoute<typeof CONNEXION> = {}
    // @ts-expect-error cette route n'a pas de corps
    const corpsEnTrop: EntreeRoute<typeof MOI> = { corps: {} }
    const lecture: EntreeRoute<typeof MOI> = {}

    expect([connexion, sansCorps, corpsEnTrop, lecture]).toHaveLength(4)
  })

  it('la sortie est la réponse validée, ou null pour un 204', () => {
    expectTypeOf<SortieRoute<typeof MOI>>().toEqualTypeOf<{
      id: string
      nom_utilisateur: string
      fuseau: string
    }>()
    expectTypeOf<SortieRoute<typeof SUPPRIMER>>().toEqualTypeOf<null>()
  })

  it('un transport est appelé avec la définition de la route', () => {
    expectTypeOf<Transport['appeler']>().toBeFunction()
  })
})

describe('validerEntree', () => {
  it('rend les parties validées', () => {
    const entree = validerEntree(CONNEXION, {
      corps: { nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' },
    })

    expect(entree.corps).toEqual({ nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' })
    expect(entree.params).toBeUndefined()
  })

  it('refuse une entrée qui ne respecte pas le schéma, avant tout envoi', () => {
    expect(() =>
      validerEntree(CONNEXION, { corps: { nom_utilisateur: '', mot_de_passe: 'x' } }),
    ).toThrow(ErreurDonnees)
  })

  it('refuse un paramètre d’URL invalide', () => {
    expect(() => validerEntree(BLOC, { params: { id: '' } })).toThrow(/GET \/blocs\/:id/)
  })
})

describe('validerSortie', () => {
  it('rend la réponse validée', () => {
    expect(validerSortie(MOI, UTILISATEUR)).toEqual(UTILISATEUR)
  })

  it('rend null quand la route n’a pas de réponse', () => {
    expect(validerSortie(SUPPRIMER, undefined)).toBeNull()
  })

  it('lève une erreur qui dit où la réponse est invalide', () => {
    const lever = () => validerSortie(MOI, { ...UTILISATEUR, fuseau: 12 })

    expect(lever).toThrow(ErreurDonnees)
    expect(lever).toThrow(/Réponse invalide pour GET \/moi : fuseau/)
  })

  it('refuse un champ inconnu (objets stricts)', () => {
    expect(() => validerSortie(MOI, { ...UTILISATEUR, mot_de_passe: 'secret' })).toThrow(
      ErreurDonnees,
    )
  })
})

describe('chemins', () => {
  it('nomme la route comme dans ROUTES', () => {
    expect(nomRoute(BLOC)).toBe('GET /blocs/:id')
  })

  it('remplit et encode les paramètres', () => {
    expect(remplirChemin('/blocs/:id', { id: 'b 05/x' })).toBe('/blocs/b%2005%2Fx')
    expect(remplirChemin('/moi', undefined)).toBe('/moi')
  })

  it('refuse un paramètre manquant', () => {
    expect(() => remplirChemin('/blocs/:id', {})).toThrow(/« id »/)
  })
})

describe('ErreurApi', () => {
  it('porte le problème et le délai avant un nouvel essai', () => {
    const erreur = new ErreurApi({
      status: 429,
      code: 'trop_de_requetes',
      titre: 'Trop de requêtes',
      detail: 'Réessaie plus tard.',
      retryAfter: 60,
    })

    expect(erreur).toBeInstanceOf(Error)
    expect(erreur).toMatchObject({ status: 429, code: 'trop_de_requetes', retryAfter: 60 })
    expect(erreur.message).toContain('Trop de requêtes (429)')
  })
})

describe('lireEntree', () => {
  it('rend les parties validées, avec leur type', () => {
    const entree = lireEntree(
      CONNEXION,
      validerEntree(CONNEXION, { corps: { nom_utilisateur: 'amine', mot_de_passe: 'x' } }),
    )

    expectTypeOf(entree.corps.nom_utilisateur).toBeString()
    expect(entree.corps).toEqual({ nom_utilisateur: 'amine', mot_de_passe: 'x' })
    expect(entree.params).toBeUndefined()
  })
})
