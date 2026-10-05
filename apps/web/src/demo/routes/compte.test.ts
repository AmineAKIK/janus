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
