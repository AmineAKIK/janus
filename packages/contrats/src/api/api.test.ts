import { describe, expect, it } from 'vitest'
import { EXEMPLES_ROUTES } from './exemples.ts'
import { ConflitEtatPage, ModificationReglages, ProblemeApi, ROUTES } from './index.ts'
import type { ModificationReglages as ModificationReglagesType } from './index.ts'
import type { CleRoute, DefinitionRoute } from './index.ts'
import { Reglages } from '../reglages.ts'

/** Les routes du ticket PR-025, telles qu'il les liste. */
const ROUTES_DU_TICKET = [
  'POST /session',
  'DELETE /session',
  'GET /moi',
  'GET /aujourdhui',
  'GET /formations',
  'GET /formations/:id/modules',
  'GET /modules/:id/blocs',
  'GET /blocs/:id',
  'POST /blocs/:id/ouvrir',
  'POST /evenements',
  'PUT /blocs/:id/etat-page',
  'POST /corrections',
  'POST /corrections/:id/accord',
  'POST /blocs/:id/erreurs',
  'POST /blocs/:id/forcer',
  'GET /questions-debut',
  'GET /cartes/dues',
  'POST /cartes/:id/note',
  'GET /verifications/:id',
  'POST /verifications/:id/reponses',
  'POST /verifications/:id/reporter',
  'GET /tableau-de-bord',
  'GET /journal',
  'GET /journal/export.txt',
  'GET /export.json',
  'GET /reglages',
  'PATCH /reglages',
  'GET /sessions',
  'DELETE /sessions/:id',
  'DELETE /compte',
  'PATCH /moi/mot-de-passe',
  'POST /corrections/:id/trancher',
  'POST /journal/notes',
  'PATCH /journal/notes/:id',
  'POST /journal/idees',
  'POST /revues-methode',
  'POST /push/abonnements',
  'DELETE /push/abonnements/:id',
]

const cles = Object.keys(ROUTES) as CleRoute[]
const schemaDe = (route: DefinitionRoute, partie: 'params' | 'requete' | 'corps' | 'reponse') =>
  route[partie]

describe('les routes de l’API', () => {
  it('contiennent toutes les routes du ticket, et seulement elles', () => {
    expect([...cles].sort()).toEqual([...ROUTES_DU_TICKET].sort())
  })

  it('portent la méthode et le chemin de leur clé', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      expect(`${route.methode} ${route.chemin}`).toBe(cle)
    }
  })

  it('ont un schéma de paramètres pour chaque paramètre du chemin, et seulement pour eux', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      const attendus = [...route.chemin.matchAll(/:(\w+)/g)].map((m) => m[1])
      const exemple = EXEMPLES_ROUTES[cle].params
      if (attendus.length === 0) {
        expect(route.params, cle).toBeUndefined()
      } else {
        expect(route.params, cle).toBeDefined()
        expect(Object.keys(exemple as object), cle).toEqual(attendus)
      }
    }
  })

  it('n’ont un corps que pour les écritures, et une réponse sans corps pour un 204', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      if (route.methode === 'GET') expect(route.corps, cle).toBeUndefined()
      expect(route.reponse === null, cle).toBe(route.succes === 204)
    }
  })

  it('ont un exemple valide pour chaque schéma', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      const exemple = EXEMPLES_ROUTES[cle]
      for (const partie of ['params', 'requete', 'corps', 'reponse'] as const) {
        const schema = schemaDe(route, partie)
        if (schema === undefined || schema === null) {
          expect(exemple[partie], `${cle} ${partie}`).toBeUndefined()
          continue
        }
        const resultat = schema.safeParse(exemple[partie])
        expect(
          resultat.success,
          `${cle} ${partie} : ${JSON.stringify(resultat.error?.issues)}`,
        ).toBe(true)
      }
    }
  })

  it('refusent chaque exemple invalide', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      for (const { partie, valeur } of EXEMPLES_ROUTES[cle].invalides) {
        const schema = schemaDe(route, partie)
        expect(schema, `${cle} ${partie}`).toBeTruthy()
        expect(
          schema?.safeParse(valeur).success,
          `${cle} ${partie} ${JSON.stringify(valeur)}`,
        ).toBe(false)
      }
    }
  })

  it('ont au moins un exemple invalide, sauf une route sans entrée ni réponse', () => {
    for (const cle of cles) {
      const route: DefinitionRoute = ROUTES[cle]
      if (route.reponse === null && route.params === undefined && route.corps === undefined)
        continue
      expect(EXEMPLES_ROUTES[cle].invalides.length, cle).toBeGreaterThan(0)
    }
  })
})

describe('les corrections', () => {
  const corps = ROUTES['POST /corrections'].corps
  const base = EXEMPLES_ROUTES['POST /corrections'].corps as Record<string, unknown>
  const sansBloc = Object.fromEntries(
    Object.entries(base).filter(([cle]) => cle !== 'bloc' && cle !== 'version'),
  )

  it('exigent le bloc et la version pour une restitution ou une consolidation', () => {
    expect(corps.safeParse({ ...sansBloc, serie: 'consolidation' }).success).toBe(false)
    expect(
      corps.safeParse({ ...sansBloc, serie: 'consolidation', bloc: 'D01', version: 3 }).success,
    ).toBe(true)
  })

  it('n’acceptent ni bloc ni version pour un rappel ou une vérification', () => {
    for (const serie of ['rappel', 'verification']) {
      expect(corps.safeParse({ ...sansBloc, serie }).success, serie).toBe(true)
      expect(corps.safeParse({ ...sansBloc, serie, bloc: 'D01' }).success, serie).toBe(false)
      expect(corps.safeParse({ ...sansBloc, serie, version: 3 }).success, serie).toBe(false)
    }
  })

  it('acceptent la contestation et la relance', () => {
    expect(corps.safeParse({ ...base, conteste: true, relance: 'Je reformule.' }).success).toBe(
      true,
    )
  })
})

describe('les erreurs', () => {
  const probleme = {
    type: 'https://janus.example.org/problemes/introuvable',
    title: 'Introuvable',
    status: 404,
    detail: 'Ce bloc n’existe pas.',
    code: 'introuvable',
  }

  it('suivent le format problem+json avec un code stable', () => {
    expect(ProblemeApi.safeParse(probleme).success).toBe(true)
    expect(ProblemeApi.safeParse({ ...probleme, code: 'panne' }).success).toBe(false)
    expect(ProblemeApi.safeParse({ ...probleme, status: 200 }).success).toBe(false)
    expect(ProblemeApi.safeParse({ ...probleme, extra: 1 }).success).toBe(false)
    expect(ProblemeApi.safeParse({ type: 'x', title: 'y', status: 400 }).success).toBe(false)
  })

  it('le conflit d’état de page porte l’état actuel', () => {
    const conflit = {
      ...probleme,
      status: 409,
      code: 'conflit',
      detail: 'Cette fiche est ouverte ailleurs.',
      version: 4,
      etat: { etape: 'ET3' },
      modifie_le: '2026-06-01T10:00:00Z',
    }
    expect(ConflitEtatPage.safeParse(conflit).success).toBe(true)
    expect(ConflitEtatPage.safeParse({ ...conflit, status: 404 }).success).toBe(false)
    expect(ConflitEtatPage.safeParse({ ...conflit, etat: null }).success).toBe(false)
  })
})

describe('la modification des réglages', () => {
  it('ne remplit aucune valeur par défaut', () => {
    expect(ModificationReglages.parse({})).toEqual({})
    expect(ModificationReglages.parse({ questionsDebut: 7 })).toEqual({ questionsDebut: 7 })
  })

  it('porte exactement les réglages de Reglages', () => {
    expect(Object.keys(ModificationReglages.shape).sort()).toEqual(
      Object.keys(Reglages.shape).sort(),
    )
  })

  it('reprend les bornes de chaque réglage', () => {
    expect(ModificationReglages.safeParse({ questionsDebut: 4 }).success).toBe(false)
    expect(ModificationReglages.safeParse({ questionsDebut: 11 }).success).toBe(false)
    expect(ModificationReglages.safeParse({ nouvellesCartesParJour: 101 }).success).toBe(false)
    expect(ModificationReglages.safeParse({ heureBascule: 3 }).success).toBe(true)
  })
})

describe('le type de la modification des réglages', () => {
  it('garde le type de chaque réglage', () => {
    const modification: ModificationReglagesType = {
      questionsDebut: 7,
      rappelsEnPauseJusquAu: null,
    }
    expect(ModificationReglages.parse(modification)).toEqual(modification)
  })
})
