import { spawn } from 'node:child_process'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../base/base.ts'
import * as t from '../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../base/testeurBase.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { horlogeFausse } from '../testeur.ts'
import { creerCompte, ErreurCompte, motsDePasseFournis } from './compte.ts'

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

  describe('sans terminal', () => {
    const lancer = (nom: string, entree: string, environnement: Record<string, string> = {}) =>
      new Promise<{ code: number | null; erreur: string; sortie: string }>((resolve) => {
        const enfant = spawn(process.execPath, ['src/cli/compteCli.ts', nom], {
          env: { ...process.env, DATABASE_URL: bases.url, ...environnement },
          cwd: new URL('../..', import.meta.url),
        })
        let sortie = ''
        let erreur = ''
        enfant.stdout.on('data', (morceau: Buffer) => (sortie += morceau.toString()))
        enfant.stderr.on('data', (morceau: Buffer) => (erreur += morceau.toString()))
        enfant.on('close', (code) => {
          resolve({ code, erreur, sortie })
        })
        enfant.stdin.end(entree)
      })
    const compterDe = async (nom: string) =>
      (await bases.db.select().from(t.users).where(eq(t.users.nomUtilisateur, nom))).length

    it('crée le compte avec deux lignes tubées', async () => {
      const resultat = await lancer('tube', 'un mot de passe solide\nun mot de passe solide\n')

      expect(resultat.code).toBe(0)
      expect(resultat.sortie).toContain('Compte « tube » créé.')
      expect(await compterDe('tube')).toBe(1)
    })

    it('crée le compte avec JANUS_MOT_DE_PASSE', async () => {
      const resultat = await lancer('variable', '', {
        JANUS_MOT_DE_PASSE: 'un mot de passe solide',
      })

      expect(resultat.code).toBe(0)
      expect(await compterDe('variable')).toBe(1)
    })

    it('refuse deux saisies différentes sans rien créer', async () => {
      const resultat = await lancer('different', 'un mot de passe solide\nun autre mot de passe\n')

      expect(resultat.code).toBe(1)
      expect(resultat.erreur).toContain('diffèrent')
      expect(await compterDe('different')).toBe(0)
    })
  })

  it('motsDePasseFournis préfère la variable, puis lit les deux premières lignes', () => {
    expect(motsDePasseFournis({ JANUS_MOT_DE_PASSE: 'a' }, 'b\nb\n')).toEqual({
      motDePasse: 'a',
      confirmation: 'a',
    })
    expect(motsDePasseFournis({ JANUS_MOT_DE_PASSE: '' }, 'b\r\nc\r\n')).toEqual({
      motDePasse: 'b',
      confirmation: 'c',
    })
    expect(motsDePasseFournis({}, '')).toEqual({ motDePasse: '', confirmation: '' })
  })
})
