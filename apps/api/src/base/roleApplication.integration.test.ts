import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { poserMotDePasseApplication } from './roleApplication.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

describe.skipIf(URL_SERVEUR_TEST === undefined)('le mot de passe du rôle de l’API', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  const aUnMotDePasse = async () => {
    const { rows } = await bases.pool.query<{ pose: boolean }>(
      "SELECT rolpassword IS NOT NULL AS pose FROM pg_authid WHERE rolname = 'janus_app'",
    )
    return rows[0]?.pose
  }

  it('est posé depuis l’adresse de l’API, y compris avec des caractères spéciaux', async () => {
    await bases.pool.query('ALTER ROLE janus_app PASSWORD NULL')
    expect(await aUnMotDePasse()).toBe(false)
    const adresse = new URL(bases.url)
    adresse.username = 'janus_app'
    adresse.password = encodeURIComponent("un'mot:de/passe")

    await poserMotDePasseApplication(bases.url, adresse.toString())

    expect(await aUnMotDePasse()).toBe(true)
  })

  it('ne touche à rien sans mot de passe dans l’adresse', async () => {
    await expect(poserMotDePasseApplication(bases.url, 'postgres://h/b')).resolves.toBeUndefined()
  })
})
