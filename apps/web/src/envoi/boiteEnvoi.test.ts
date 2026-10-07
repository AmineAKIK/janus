import { EXEMPLES_PAGE, ErreurApi, ErreurReseau, MessagePage } from '@janus/contrats'
import type { Transport } from '@janus/contrats'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerBoiteEnvoi, creerVerrouLocal, DELAIS_REESSAI_S } from './boiteEnvoi.ts'
import { envoiDeMessage } from './messages.ts'
import { creerStockageMemoire } from './stockageEnvoi.ts'

const ID1 = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'
const ID2 = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c'
const ID3 = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2d'

const evenement = (id: string) => ({
  id,
  route: 'POST /evenements',
  corps: { ...EXEMPLES_PAGE['etape.vue'], id },
})
const etat = (id: string, etape: string) => ({
  id,
  route: 'PUT /blocs/:id/etat-page',
  params: { id: 'D01' },
  corps: { version: 0, etat: { etape } },
  cle: 'etat:D01',
})
const REPONSE_EVENEMENT = { doublon: false, statut: null }

function erreur(status: number) {
  return new ErreurApi({ status, code: 'donnees_invalides', titre: 'Erreur', detail: 'x' })
}

function monter(comportements: (() => unknown)[] = []) {
  const stockage = creerStockageMemoire()
  const appels: string[] = []
  const transport: Transport = {
    appeler: (route, entree) => {
      const corps: unknown = 'corps' in entree ? entree.corps : undefined
      const identifiant =
        typeof corps === 'object' && corps !== null && 'id' in corps ? String(corps.id) : '-'
      appels.push(`${route.methode} ${route.chemin} ${identifiant}`)
      const suite = comportements.shift()
      const resultat = suite === undefined ? REPONSE_EVENEMENT : suite()
      return Promise.resolve(resultat) as never
    },
  }
  const echecs = {
    refus: vi.fn(),
    conflit: vi.fn(),
    reponse: vi.fn(),
  }
  const planifications: { action: () => void; delaiMs: number }[] = []
  const boite = creerBoiteEnvoi(
    {
      stockage,
      transport,
      verrou: creerVerrouLocal(),
      maintenant: () => '2026-10-06T08:00:00.000Z',
      planifier: (action, delaiMs) => {
        planifications.push({ action, delaiMs })
        return () => undefined
      },
    },
    { surRefus: echecs.refus, surConflit: echecs.conflit, surReponse: echecs.reponse },
  )
  return { boite, stockage, appels, echecs, planifications }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('boîte d’envoi', () => {
  it('écrit le message avant de tenter l’envoi', async () => {
    const { boite, stockage } = monter([
      () => {
        throw new ErreurReseau()
      },
    ])

    await boite.ajouter(evenement(ID1))

    // L'envoi a échoué : seule l'écriture préalable explique que le message soit encore là.
    expect(await stockage.lister()).toHaveLength(1)
  })

  it('un 2xx supprime l’entrée et rend la réponse', async () => {
    const { boite, stockage, echecs } = monter()
    const surReponse = vi.fn()

    await boite.ajouter(evenement(ID1), { surReponse })

    expect(await stockage.lister()).toHaveLength(0)
    expect(surReponse).toHaveBeenCalledWith(REPONSE_EVENEMENT)
    expect(echecs.reponse).toHaveBeenCalledOnce()
  })

  it('envoie dans l’ordre de création', async () => {
    const { boite, appels } = monter([
      () => {
        throw new ErreurReseau()
      },
    ])

    await boite.ajouter(evenement(ID1))
    await boite.ajouter(evenement(ID2))
    await boite.ajouter(evenement(ID3))
    await boite.vider()

    expect(appels.filter((appel) => appel.endsWith(ID1))).toHaveLength(2)
    expect(appels.slice(-3).map((appel) => appel.slice(-4))).toEqual(['1a2b', '1a2c', '1a2d'])
  })

  it('un échec réseau garde l’entrée, compte l’essai et planifie le nouvel essai', async () => {
    const { boite, stockage, planifications } = monter([
      () => {
        throw new ErreurReseau()
      },
    ])

    await boite.ajouter(evenement(ID1))

    const [entree] = await stockage.lister()
    expect(entree?.essais).toBe(1)
    expect(planifications.at(-1)?.delaiMs).toBe(2000)
  })

  it('les délais de nouvel essai : 2, 4, 8, 16, 32 puis 60 secondes', async () => {
    const echecs = Array.from({ length: 8 }, () => () => {
      throw erreur(503)
    })
    const { boite, planifications } = monter(echecs)

    await boite.ajouter(evenement(ID1))
    for (let i = 0; i < 7; i += 1) await boite.vider()

    expect(planifications.map(({ delaiMs }) => delaiMs / 1000)).toEqual([
      ...DELAIS_REESSAI_S,
      60,
      60,
    ])
  })

  it.each([400, 422])('un %i supprime l’entrée et le signale', async (status) => {
    const { boite, stockage, echecs } = monter([
      () => {
        throw erreur(status)
      },
    ])
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const surRefus = vi.fn()

    await boite.ajouter(evenement(ID1), { surRefus })

    expect(await stockage.lister()).toHaveLength(0)
    expect(echecs.refus).toHaveBeenCalledOnce()
    expect(surRefus).toHaveBeenCalledOnce()
  })

  it.each([429, 503])(
    'une correction que l’IA ne peut pas rendre (%i) est rendue à la page, pas réessayée',
    async (status) => {
      const { boite, stockage, appels } = monter([
        () => {
          throw erreur(status)
        },
      ])
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const surRefus = vi.fn()
      const demande = MessagePage.parse({ ...EXEMPLES_PAGE['restitution.demande'], id: ID1 })

      await boite.ajouter({ ...envoiDeMessage(demande, 0), id: ID1 }, { surRefus })

      expect(await stockage.lister()).toHaveLength(0)
      expect(appels).toHaveLength(1)
      expect(surRefus).toHaveBeenCalledWith(expect.objectContaining({ status }))
    },
  )

  it('un 503 sur un événement est réessayé, il ne vient pas de l’IA', async () => {
    const { boite, stockage } = monter([
      () => {
        throw erreur(503)
      },
    ])

    await boite.ajouter(evenement(ID1))

    expect(await stockage.lister()).toHaveLength(1)
  })

  it('un 401 suspend l’envoi sans rien supprimer, jusqu’à la reconnexion', async () => {
    const { boite, stockage, appels } = monter([
      () => {
        throw erreur(401)
      },
    ])

    await boite.ajouter(evenement(ID1))
    await boite.ajouter(evenement(ID2))

    expect(appels).toHaveLength(1)
    expect(await stockage.lister()).toHaveLength(2)

    await boite.reprendre()

    expect(await stockage.lister()).toHaveLength(0)
  })

  it('un 409 sur l’état d’une page n’écrase rien et le signale', async () => {
    const { boite, stockage, echecs } = monter([
      () => {
        throw erreur(409)
      },
    ])
    const surConflit = vi.fn()

    await boite.ajouter(etat(ID1, 'ET2'), { surConflit })

    expect(await stockage.lister()).toHaveLength(0)
    expect(echecs.conflit).toHaveBeenCalledOnce()
    expect(surConflit).toHaveBeenCalledOnce()
  })

  it('l’état d’une page garde une seule entrée par bloc : la plus récente', async () => {
    const { boite, stockage } = monter([
      () => {
        throw new ErreurReseau()
      },
      () => {
        throw new ErreurReseau()
      },
    ])

    await boite.ajouter(etat(ID1, 'ET2'))
    await boite.ajouter(etat(ID2, 'ET3'))

    const entrees = await stockage.lister()
    expect(entrees).toHaveLength(1)
    expect(entrees[0]?.id).toBe(ID2)
  })

  it('une entrée abîmée est supprimée, pas envoyée', async () => {
    const { boite, stockage, appels } = monter()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await boite.ajouter({ id: ID1, route: 'POST /evenements', corps: { n: 'importe quoi' } })

    expect(appels).toHaveLength(0)
    expect(await stockage.lister()).toHaveLength(0)
  })

  it('l’état d’une page part avec la dernière version connue', async () => {
    const versions: unknown[] = []
    const stockage = creerStockageMemoire()
    const transport: Transport = {
      appeler: (_route, entree) => {
        versions.push('corps' in entree && typeof entree.corps === 'object' ? entree.corps : null)
        return Promise.resolve({ version: 6 }) as never
      },
    }
    const boite = creerBoiteEnvoi({
      stockage,
      transport,
      verrou: creerVerrouLocal(),
      maintenant: () => '2026-10-06T08:00:00.000Z',
    })
    boite.fixerVersion('D01', 4)

    await boite.ajouter(etat(ID1, 'ET2'))
    await boite.ajouter(etat(ID2, 'ET3'))

    expect(versions).toMatchObject([{ version: 4 }, { version: 6 }])
  })
})

describe('verrou local', () => {
  it('exécute les travaux l’un après l’autre', async () => {
    const verrou = creerVerrouLocal()
    const journal: string[] = []
    const travail = (nom: string) => async () => {
      journal.push(`debut ${nom}`)
      await Promise.resolve()
      journal.push(`fin ${nom}`)
    }

    await Promise.all([verrou(travail('a')), verrou(travail('b'))])

    expect(journal).toEqual(['debut a', 'fin a', 'debut b', 'fin b'])
  })
})

describe('envoiDeMessage', () => {
  it('choisit la route de chaque message', () => {
    const route = (type: keyof typeof EXEMPLES_PAGE) =>
      envoiDeMessage(MessagePage.parse(EXEMPLES_PAGE[type]), 3).route

    expect(route('etat.sauver')).toBe('PUT /blocs/:id/etat-page')
    expect(route('bilan.erreurs')).toBe('POST /evenements')
    expect(route('correction.accord')).toBe('POST /corrections/:id/accord')
    expect(route('etape.vue')).toBe('POST /evenements')
    expect(route('pratique.resultat')).toBe('POST /evenements')
    expect(route('restitution.demande')).toBe('POST /corrections')
  })

  it('l’état d’une page porte la version et une clé par bloc', () => {
    expect(envoiDeMessage(MessagePage.parse(EXEMPLES_PAGE['etat.sauver']), 3)).toMatchObject({
      corps: { version: 3 },
      cle: 'etat:D01',
    })
  })
})
