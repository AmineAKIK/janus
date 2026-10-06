import { ErreurApi, ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'
import { IDENTIFIANT_DEMO, MOT_DE_PASSE_DEMO } from './compte.ts'

const connexion = (mot_de_passe: string) => ({
  corps: { nom_utilisateur: IDENTIFIANT_DEMO, mot_de_passe },
})

async function erreurDe(promesse: Promise<unknown>): Promise<ErreurApi> {
  const erreur: unknown = await promesse.then(
    () => null,
    (e: unknown) => e,
  )
  if (!(erreur instanceof ErreurApi)) throw new Error('Une ErreurApi était attendue')
  return erreur
}

describe('routes de compte de la démo', () => {
  it('connecte amine avec le mot de passe de la démo, puis rend le compte', async () => {
    const { transport } = monterDemo({ connecte: false })

    const moi = await transport.appeler(ROUTES['POST /session'], connexion(MOT_DE_PASSE_DEMO))

    expect(moi).toMatchObject({ nom_utilisateur: 'amine', fuseau: 'Europe/Paris' })
    await expect(transport.appeler(ROUTES['GET /moi'], {})).resolves.toEqual(moi)
  })

  it('refuse un mauvais mot de passe avec un 401', async () => {
    const { transport } = monterDemo({ connecte: false })

    const erreur = await erreurDe(transport.appeler(ROUTES['POST /session'], connexion('faux')))

    expect(erreur).toMatchObject({ status: 401, code: 'non_authentifie' })
  })

  it('sans session, GET /moi répond 401', async () => {
    const { transport } = monterDemo({ connecte: false })

    expect(await erreurDe(transport.appeler(ROUTES['GET /moi'], {}))).toMatchObject({
      status: 401,
    })
  })

  it('se déconnecte', async () => {
    const { transport } = monterDemo()

    await expect(transport.appeler(ROUTES['DELETE /session'], {})).resolves.toBeNull()

    expect(await erreurDe(transport.appeler(ROUTES['GET /moi'], {}))).toMatchObject({
      status: 401,
    })
  })

  it('bloque 60 secondes au cinquième échec en une minute, même avec le bon mot de passe', async () => {
    const { transport, horloge } = monterDemo({ connecte: false })
    for (let i = 0; i < 4; i += 1) {
      horloge.avancer(10_000)
      expect(
        await erreurDe(transport.appeler(ROUTES['POST /session'], connexion('faux'))),
      ).toMatchObject({ status: 401 })
    }

    horloge.avancer(10_000)
    const cinquieme = await erreurDe(transport.appeler(ROUTES['POST /session'], connexion('faux')))
    horloge.avancer(30_000)
    const pendant = await erreurDe(
      transport.appeler(ROUTES['POST /session'], connexion(MOT_DE_PASSE_DEMO)),
    )

    expect(cinquieme).toMatchObject({ status: 429, code: 'trop_de_requetes', retryAfter: 60 })
    expect(pendant).toMatchObject({ status: 429, retryAfter: 30 })

    horloge.avancer(30_000)
    await expect(
      transport.appeler(ROUTES['POST /session'], connexion(MOT_DE_PASSE_DEMO)),
    ).resolves.toMatchObject({ nom_utilisateur: 'amine' })
  })

  it('ne compte que les échecs de la dernière minute', async () => {
    const { transport, horloge } = monterDemo({ connecte: false })
    for (let i = 0; i < 4; i += 1) {
      await erreurDe(transport.appeler(ROUTES['POST /session'], connexion('faux')))
      horloge.avancer(20_000)
    }

    // Les deux premiers échecs ont plus d'une minute : le cinquième n'est que le troisième de la fenêtre.
    expect(
      await erreurDe(transport.appeler(ROUTES['POST /session'], connexion('faux'))),
    ).toMatchObject({ status: 401 })
  })
})

describe('mot de passe et sessions de la démo', () => {
  it('change le mot de passe, que la connexion suivante utilise', async () => {
    const { transport } = monterDemo()

    await transport.appeler(ROUTES['PATCH /moi/mot-de-passe'], {
      corps: { ancien: MOT_DE_PASSE_DEMO, nouveau: 'un-nouveau-secret' },
    })

    await expect(
      transport.appeler(ROUTES['POST /session'], connexion(MOT_DE_PASSE_DEMO)),
    ).rejects.toMatchObject({ status: 401 })
    const moi = await transport.appeler(ROUTES['POST /session'], connexion('un-nouveau-secret'))
    expect(moi.nom_utilisateur).toBe(IDENTIFIANT_DEMO)
  })

  it('refuse un ancien mot de passe faux', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['PATCH /moi/mot-de-passe'], {
        corps: { ancien: 'faux', nouveau: 'un-nouveau-secret' },
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('liste la session courante puis les autres, et en retire une', async () => {
    const { transport } = monterDemo()
    const { sessions } = await transport.appeler(ROUTES['GET /sessions'], {})
    expect(sessions.filter(({ courante }) => courante)).toHaveLength(1)
    const autre = sessions.find(({ courante }) => !courante)
    if (autre === undefined) throw new Error('Aucune autre session')

    await transport.appeler(ROUTES['DELETE /sessions/:id'], { params: { id: autre.id } })

    const apres = await transport.appeler(ROUTES['GET /sessions'], {})
    expect(apres.sessions.some(({ id }) => id === autre.id)).toBe(false)
    await expect(
      transport.appeler(ROUTES['DELETE /sessions/:id'], { params: { id: autre.id } }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
