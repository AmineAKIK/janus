import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../base/base.ts'
import * as t from '../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../base/testeurBase.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { horlogeFausse } from '../testeur.ts'
import { creerCompte, ErreurCompte } from './compte.ts'

describe.skipIf(URL_SERVEUR_TEST === undefined)('pnpm compte:creer', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  const hacheur = creerHacheur(4)
  const creer = (nom: string, motDePasse: string) =>
    creerCompte(
      { base: baseDepuisPool(bases.db, bases.pool), hacheur, horloge: horlogeFausse() },
      nom,
      motDePasse,
    )

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  it('crée un compte dont le mot de passe est haché, avec les réglages par défaut', async () => {
    const id = await creer('amine', 'un mot de passe solide')

    const [ligne] = await bases.db.select().from(t.users).where(eq(t.users.id, id))

    expect(ligne?.nomUtilisateur).toBe('amine')
    expect(ligne?.motDePasseHash).not.toContain('solide')
    expect(await hacheur.comparer('un mot de passe solide', ligne?.motDePasseHash ?? '')).toBe(true)
    expect(ligne?.reglages).toMatchObject({ fuseau: 'Europe/Paris' })
  })

  it('refuse un nom vide, un mot de passe trop court ou de plus de 72 octets', async () => {
    await expect(creer('  ', 'un mot de passe solide')).rejects.toThrow(ErreurCompte)
    await expect(creer('court', 'court')).rejects.toThrow(/au moins 12 caractères/)
    await expect(creer('long', 'é'.repeat(37))).rejects.toThrow(/72 octets/)
  })

  it('refuse un nom déjà pris, sans tenir compte des majuscules', async () => {
    await expect(creer('AMINE', 'un mot de passe solide')).rejects.toThrow(/déjà pris/)
  })
})
