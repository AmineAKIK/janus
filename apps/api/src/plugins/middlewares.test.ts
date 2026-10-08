import { nouvelId } from '@janus/contrats'
import Fastify from 'fastify'
import type { FastifyInstance, RouteOptions } from 'fastify'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  BudgetAtteint,
  Conflit,
  ContenuDifferent,
  Introuvable,
  PreconditionEchouee,
  Refus,
} from '../erreurs.ts'
import { ORIGINE_TEST, serveurDeTest } from '../testeur.ts'
import { NOMS_MIDDLEWARES } from '../types.ts'
import { REQUETES_PAR_MINUTE } from './ordre.ts'
import { DELAI_DEFAUT_MS, LIMITE_CORPS_DEFAUT, limitesParRoute } from './limites.ts'

const ECRITURE = { origin: ORIGINE_TEST, 'content-type': 'application/json' }
const KO = 1024

/** Des routes d'essai, déclarées après la chaîne comme le seront les routes métier. */
async function ajouterRoutesDEssai(app: FastifyInstance): Promise<RouteOptions[]> {
  const routes: RouteOptions[] = []
  app.addHook('onRoute', (route) => {
    routes.push(route)
  })
  await app.register(
    (interne, _options, fini) => {
      const publique = { publique: true }
      interne.get('/essai/session', { config: publique }, (requete) => requete.session)
      interne.get('/essai/prive', () => ({ secret: true }))
      interne.get('/essai/erreur/:genre', { config: publique }, (requete) => {
        const { genre } = z.object({ genre: z.string() }).parse(requete.params)
        const erreurs: Record<string, Error> = {
          refus: new Refus('Tu n’as pas le droit.'),
          introuvable: new Introuvable('Ce bloc n’existe pas.'),
          conflit: new Conflit('Déjà fait.'),
          different: new ContenuDifferent('Le contenu a changé.'),
          budget: new BudgetAtteint('Plafond atteint.'),
          precondition: new PreconditionEchouee('Version périmée.'),
          inattendue: new Error('mot de passe de la base: hunter2'),
        }
        throw erreurs[genre] ?? new Error('genre inconnu')
      })
      interne.post(
        '/essai/ecrire',
        {
          config: { publique: true, identifiant: true },
          schema: { body: z.looseObject({ texte: z.string().min(2) }) },
        },
        () => ({ fait: true }),
      )
      interne.post('/essai/sans-id', { config: { publique: true, identifiant: true } }, () => ({
        fait: true,
      }))
      interne.get(
        '/essai/filtre',
        {
          config: publique,
          schema: { response: { 200: z.object({ visible: z.string() }) } },
        },
        () => ({ visible: 'oui', secret: 'non' }),
      )
      interne.get('/essai/lent', { config: publique, handlerTimeout: 50 }, async () => {
        await new Promise((resolu) => setTimeout(resolu, 400))
        return { tard: true }
      })
      interne.post('/essai/gros', { config: { publique: true, identifiant: false } }, () => ({
        fait: true,
      }))
      fini()
    },
    { prefix: '' },
  )
  return routes
}

describe('1. identifiant de requête et journal', () => {
  it('rend l’identifiant dans x-request-id et le met dans le journal', async () => {
    const { app, journal } = await serveurDeTest()

    const reponse = await app.inject({ method: 'GET', url: '/api/sante' })

    const id = reponse.headers['x-request-id']
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(journal.some((ligne) => ligne['reqId'] === id)).toBe(true)
  })

  it('reprend un x-request-id sain et remplace un identifiant douteux', async () => {
    const { app } = await serveurDeTest()

    const repris = await app.inject({
      method: 'GET',
      url: '/api/sante',
      headers: { 'x-request-id': 'abc-123_XYZ' },
    })
    const douteux = await app.inject({
      method: 'GET',
      url: '/api/sante',
      headers: { 'x-request-id': 'a b\nc{"niveau":60}' },
    })

    expect(repris.headers['x-request-id']).toBe('abc-123_XYZ')
    expect(douteux.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('2. limite de corps et délai', () => {
  it('donne 75 s à POST /api/corrections et 256 ko à PUT /api/blocs/:id/etat-page', async () => {
    const app = Fastify()
    limitesParRoute(app)
    const routes: RouteOptions[] = []
    app.addHook('onRoute', (route) => {
      routes.push(route)
    })
    app.post('/api/corrections', () => ({}))
    app.put('/api/blocs/:id/etat-page', () => ({}))
    await app.ready()

    expect(
      routes.map(({ url, handlerTimeout, bodyLimit }) => [url, handlerTimeout, bodyLimit]),
    ).toEqual([
      ['/api/corrections', 75_000, 64 * KO],
      ['/api/blocs/:id/etat-page', 15_000, 256 * KO],
    ])
  })

  it('refuse en 413 un corps de plus de 64 ko', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)
    const gros = JSON.stringify({ texte: 'x'.repeat(100 * KO) })

    const refuse = await app.inject({
      method: 'POST',
      url: '/essai/gros',
      headers: ECRITURE,
      payload: gros,
    })

    expect(refuse.statusCode).toBe(413)
    expect(refuse.json()).toMatchObject({ code: 'donnees_invalides', status: 413 })
  })

  it('donne 15 s à chaque route et 64 ko de corps par défaut', async () => {
    const { app } = await serveurDeTest()
    const routes = await ajouterRoutesDEssai(app)
    const de = (methode: string, url: string) =>
      routes.find((route) => route.url === url && [route.method].flat().includes(methode))

    expect(DELAI_DEFAUT_MS).toBe(15_000)
    expect(LIMITE_CORPS_DEFAUT).toBe(64 * KO)
    expect(de('POST', '/essai/gros')?.handlerTimeout).toBe(15_000)
    expect(de('POST', '/essai/gros')?.bodyLimit).toBe(64 * KO)
  })

  it('rend 503 delai_depasse quand le délai de la route est dépassé', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({ method: 'GET', url: '/essai/lent' })

    expect(reponse.statusCode).toBe(503)
    expect(reponse.json()).toMatchObject({ code: 'delai_depasse', status: 503 })
  })
})

describe('3. en-têtes de sécurité', () => {
  it('pose les en-têtes helmet', async () => {
    const { app } = await serveurDeTest()

    const { headers } = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['strict-transport-security']).toBeDefined()
    expect(headers['x-powered-by']).toBeUndefined()
  })
})

describe('4. CORS fermé', () => {
  it('n’autorise aucune autre origine, même en préalable', async () => {
    const { app } = await serveurDeTest()

    const simple = await app.inject({
      method: 'GET',
      url: '/api/sante',
      headers: { origin: 'https://autre.example' },
    })
    const prealable = await app.inject({
      method: 'OPTIONS',
      url: '/api/sante',
      headers: {
        origin: 'https://autre.example',
        'access-control-request-method': 'POST',
      },
    })

    expect(simple.headers['access-control-allow-origin']).toBeUndefined()
    expect(prealable.headers['access-control-allow-origin']).toBeUndefined()
    expect(prealable.headers['access-control-allow-methods']).toBeUndefined()
  })
})

describe('5. limite de débit', () => {
  it('laisse passer 300 requêtes par minute, refuse la suivante en 429 avec Retry-After', async () => {
    const { app } = await serveurDeTest()
    expect(REQUETES_PAR_MINUTE).toBe(300)

    for (let i = 0; i < REQUETES_PAR_MINUTE; i += 1) {
      const reponse = await app.inject({ method: 'GET', url: '/api/sante' })
      expect(reponse.statusCode).toBe(200)
    }
    const refusee = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(refusee.statusCode).toBe(429)
    expect(refusee.headers['content-type']).toContain('application/problem+json')
    expect(refusee.json()).toMatchObject({ code: 'trop_de_requetes', status: 429 })
    expect(refusee.headers['retry-after']).toBeDefined()
  })

  it('compte chaque adresse séparément', async () => {
    const { app } = await serveurDeTest()
    for (let i = 0; i <= REQUETES_PAR_MINUTE; i += 1) {
      await app.inject({ method: 'GET', url: '/api/sante', remoteAddress: '10.0.0.1' })
    }

    const autre = await app.inject({ method: 'GET', url: '/api/sante', remoteAddress: '10.0.0.2' })

    expect(autre.statusCode).toBe(200)
  })
})

describe('6. cookie et session', () => {
  it('donne à chaque requête une session vide', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({
      method: 'GET',
      url: '/essai/session',
      headers: { cookie: 'janus=faux' },
    })

    expect(reponse.json()).toEqual({ utilisateur: null, sessionId: null })
  })
})

describe('7. contrôle de l’en-tête Origin', () => {
  it('refuse en 403 une écriture sans Origin ou avec une autre origine', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)
    const ecrire = (headers: Record<string, string>) =>
      app.inject({
        method: 'POST',
        url: '/essai/ecrire',
        headers: { 'content-type': 'application/json', ...headers },
        payload: JSON.stringify({ id: nouvelId(1), texte: 'ok' }),
      })

    const sans = await ecrire({})
    const autre = await ecrire({ origin: 'https://autre.example' })
    const bonne = await ecrire({ origin: ORIGINE_TEST })

    expect(sans.statusCode).toBe(403)
    expect(sans.json()).toMatchObject({ code: 'origine_refusee' })
    expect(autre.statusCode).toBe(403)
    expect(bonne.statusCode).toBe(200)
  })

  it.each(['PUT', 'PATCH', 'DELETE'] as const)('contrôle aussi %s', async (methode) => {
    const { app } = await serveurDeTest()

    const reponse = await app.inject({ method: methode, url: '/api/sante' })

    expect(reponse.statusCode).toBe(403)
  })

  it('ne contrôle pas les lectures', async () => {
    const { app } = await serveurDeTest()

    const reponse = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(reponse.statusCode).toBe(200)
  })
})

describe('8. authentification', () => {
  it('rend 401 sur toute route non publique, 200 sur la santé', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const privee = await app.inject({ method: 'GET', url: '/essai/prive' })
    const inconnue = await app.inject({ method: 'GET', url: '/api/inexistante' })
    const sante = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(privee.statusCode).toBe(401)
    expect(privee.json()).toMatchObject({ code: 'non_authentifie', status: 401 })
    expect(inconnue.statusCode).toBe(401)
    expect(sante.statusCode).toBe(200)
  })

  it('passe après le contrôle d’origine : une écriture hors origine reste un 403', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({ method: 'POST', url: '/essai/prive' })

    expect(reponse.statusCode).toBe(403)
  })
})

describe('9. validation d’entrée et filtrage de sortie', () => {
  it('rend 400 donnees_invalides avec le champ en cause', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({
      method: 'POST',
      url: '/essai/ecrire',
      headers: ECRITURE,
      payload: JSON.stringify({ id: nouvelId(2), texte: 'x' }),
    })

    expect(reponse.statusCode).toBe(400)
    expect(reponse.json()).toMatchObject({ code: 'donnees_invalides', status: 400 })
    expect(reponse.json<{ detail: string }>().detail).toContain('/texte')
  })

  it('rend 400 sur un JSON cassé', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({
      method: 'POST',
      url: '/essai/ecrire',
      headers: ECRITURE,
      payload: '{ pas du json',
    })

    expect(reponse.statusCode).toBe(400)
    expect(reponse.json()).toMatchObject({ code: 'donnees_invalides' })
  })

  it('ne rend que les champs du schéma de sortie', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({ method: 'GET', url: '/essai/filtre' })

    expect(reponse.json()).toEqual({ visible: 'oui' })
  })
})

describe('10. une écriture porte son identifiant', () => {
  it('rend 400 quand le corps n’a pas d’identifiant UUID, 200 avec', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)
    const envoyer = (corps: unknown) =>
      app.inject({
        method: 'POST',
        url: '/essai/sans-id',
        headers: ECRITURE,
        payload: JSON.stringify(corps),
      })

    const sans = await envoyer({ texte: 'ok' })
    const faux = await envoyer({ id: 'pas-un-uuid' })
    const nul = await envoyer(null)
    const bon = await envoyer({ id: nouvelId(3) })

    expect(sans.statusCode).toBe(400)
    expect(sans.json()).toMatchObject({ code: 'donnees_invalides', title: 'Identifiant manquant' })
    expect(faux.statusCode).toBe(400)
    expect(nul.statusCode).toBe(400)
    expect(bon.statusCode).toBe(200)
  })

  it('refuse au démarrage une route d’écriture qui ne déclare pas config.identifiant', async () => {
    const { app } = await serveurDeTest()

    expect(() => app.post('/essai/oubli', () => ({}))).toThrow(
      /POST \/essai\/oubli : une route d’écriture déclare config.identifiant/,
    )
  })
})

describe('11. gestionnaire d’erreurs', () => {
  it.each([
    ['refus', 403, 'refus'],
    ['introuvable', 404, 'introuvable'],
    ['conflit', 409, 'conflit'],
    ['different', 422, 'contenu_different'],
    ['budget', 429, 'budget_atteint'],
    ['precondition', 412, 'precondition_echouee'],
  ])('traduit l’erreur %s en problem+json %i', async (genre, status, code) => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({ method: 'GET', url: `/essai/erreur/${genre}` })

    expect(reponse.statusCode).toBe(status)
    expect(reponse.headers['content-type']).toContain('application/problem+json')
    expect(reponse.json()).toMatchObject({ status, code, type: `urn:janus:erreur:${code}` })
  })

  it('rend 500 sans détail pour une erreur inattendue et journalise la pile', async () => {
    const { app, journal } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const reponse = await app.inject({ method: 'GET', url: '/essai/erreur/inattendue' })

    expect(reponse.statusCode).toBe(500)
    expect(reponse.json()).toMatchObject({
      code: 'erreur_interne',
      detail: 'Une erreur est survenue.',
    })
    expect(reponse.body).not.toContain('hunter2')
    const ligne = journal.find((entree) => entree['msg'] === 'erreur inattendue')
    expect(JSON.stringify(ligne)).toContain('hunter2')
    expect(JSON.stringify(ligne)).toContain('stack')
  })
})

describe('12. journal de fin de requête', () => {
  it('écrit méthode, route, statut et durée une fois la réponse partie', async () => {
    const { app, journal } = await serveurDeTest()

    await app.inject({ method: 'GET', url: '/api/sante' })

    const fin = journal.find((ligne) => ligne['msg'] === 'requête terminée')
    expect(fin).toMatchObject({ methode: 'GET', route: '/api/sante', statut: 200, dureeMs: 0 })
  })

  it('mesure la durée avec l’horloge injectée', async () => {
    const { app, journal, horloge } = await serveurDeTest()
    await app.register((interne, _options, fini) => {
      interne.get('/essai/duree', { config: { publique: true } }, () => {
        horloge.avancer(250)
        return {}
      })
      fini()
    })

    await app.inject({ method: 'GET', url: '/essai/duree' })

    const fin = journal.find((ligne) => ligne['route'] === '/essai/duree')
    expect(fin).toMatchObject({ dureeMs: 250 })
  })
})

describe('ETag', () => {
  it('pose un ETag sur un GET et rend 304 si le client l’a déjà', async () => {
    const { app } = await serveurDeTest()

    const premiere = await app.inject({ method: 'GET', url: '/api/sante' })
    const etag = premiere.headers['etag']
    const seconde = await app.inject({
      method: 'GET',
      url: '/api/sante',
      headers: { 'if-none-match': String(etag) },
    })

    expect(etag).toBeDefined()
    expect(seconde.statusCode).toBe(304)
  })

  it('n’en pose ni sur une écriture ni sur une erreur', async () => {
    const { app } = await serveurDeTest()
    await ajouterRoutesDEssai(app)

    const ecriture = await app.inject({
      method: 'POST',
      url: '/essai/ecrire',
      headers: ECRITURE,
      payload: JSON.stringify({ id: nouvelId(4), texte: 'ok' }),
    })
    const erreur = await app.inject({ method: 'GET', url: '/essai/erreur/refus' })

    expect(ecriture.headers['etag']).toBeUndefined()
    expect(erreur.headers['etag']).toBeUndefined()
  })
})

describe('l’ordre de la chaîne', () => {
  it('une requête qui réussit traverse les middlewares dans l’ordre de l’architecture', async () => {
    const { app, passages } = await serveurDeTest()

    await app.inject({ method: 'GET', url: '/api/sante' })

    expect(passages).toEqual([
      'identifiant_requete',
      'limites',
      'helmet',
      'cors',
      'limite_debit',
      'session',
      'origine',
      'authentification',
      'validation',
      'identifiant_ecriture',
      'etag',
      'journal_fin',
    ])
  })

  it('la liste déclarée est dans l’ordre de la chaîne, gestionnaire d’erreurs avant ETag et journal', () => {
    expect(NOMS_MIDDLEWARES).toEqual([
      'identifiant_requete',
      'limites',
      'helmet',
      'cors',
      'limite_debit',
      'session',
      'origine',
      'authentification',
      'validation',
      'identifiant_ecriture',
      'gestionnaire_erreurs',
      'etag',
      'journal_fin',
    ])
  })

  it('une origine refusée arrête la chaîne avant l’authentification, mais passe par le gestionnaire', async () => {
    const { app, passages } = await serveurDeTest()

    await app.inject({ method: 'POST', url: '/api/sante' })

    expect(passages).toEqual([
      'identifiant_requete',
      'limites',
      'helmet',
      'cors',
      'limite_debit',
      'session',
      'origine',
      'gestionnaire_erreurs',
      'etag',
      'journal_fin',
    ])
  })

  it('une requête sans session arrête la chaîne à l’authentification, avant la validation', async () => {
    const { app, passages } = await serveurDeTest()

    await app.inject({ method: 'GET', url: '/api/inexistante' })

    expect(passages).toEqual([
      'identifiant_requete',
      'limites',
      'helmet',
      'cors',
      'limite_debit',
      'session',
      'origine',
      'authentification',
      'gestionnaire_erreurs',
      'etag',
      'journal_fin',
    ])
  })

  it('une entrée invalide arrête la chaîne avant le contrôle de l’identifiant', async () => {
    const { app, passages } = await serveurDeTest()
    await ajouterRoutesDEssai(app)
    passages.length = 0

    await app.inject({
      method: 'POST',
      url: '/essai/ecrire',
      headers: ECRITURE,
      payload: JSON.stringify({ texte: 'x' }),
    })

    expect(passages).toEqual([
      'identifiant_requete',
      'limites',
      'helmet',
      'cors',
      'limite_debit',
      'session',
      'origine',
      'authentification',
      'gestionnaire_erreurs',
      'etag',
      'journal_fin',
    ])
  })
})
