import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import type { Scenario } from '../../adaptateurs/correcteur/faux.ts'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'
import { monterImportation } from '../catalogue/composition.ts'

const FICHE_DEMO = new URL('../../../../web/public/fiches/demo/fiche-demo.html', import.meta.url)
const MOT_DE_PASSE = 'un mot de passe solide'
const CATALOGUE = {
  formation: { code: 'DWWM', titre: 'Développeur web', description: 'Titre pro' },
  modules: [
    {
      code: 'M1',
      titre: 'Les bases',
      description: 'Pour commencer',
      ordre: 1,
      importe: true,
      parties: [{ code: 'P1', titre: 'Démarrer', blocs: ['D01'] }],
    },
  ],
}
const REPONSE_LONGUE =
  'Une fiche résume un seul bloc de cours avec ses exercices et son bilan, comme un petit guide.'

describe.skipIf(URL_SERVEUR_TEST === undefined)('POST /corrections contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let sequence = 0
  let scenario: Scenario | undefined
  let hasardCourant = 0.5
  const faux = creerFaux((requete, appel) => scenario?.(requete, appel))

  const identifiant = () => {
    sequence += 1
    return nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + sequence)
  }
  let tentative = 0
  /** Une demande de premier tour sur la question R1, sur une tentative neuve. */
  const demande = (surcharge: Record<string, unknown> = {}) => {
    tentative += 1
    return {
      id: identifiant(),
      serie: 'restitution',
      tentative,
      question: 'R1',
      reponse: REPONSE_LONGUE,
      confiance: 'sur',
      relance: '',
      support: { colle: false, retour_cours: false },
      bloc: 'D01',
      version: 1,
      ...surcharge,
    }
  }
  const corriger = (corps: Record<string, unknown>, serveur = s, avecCookie = true) =>
    serveur.app.inject({
      method: 'POST',
      url: '/api/corrections',
      headers: { ...(avecCookie ? { cookie } : {}), origin: ORIGINE_TEST },
      payload: corps,
    })
  const reglages = (valeurs: Record<string, unknown>) =>
    bases.db
      .update(t.users)
      .set({ reglages: Reglages.parse(valeurs) })
      .where(eq(t.users.id, userId))
  const budget = async () => {
    const { rows } = await bases.pool.query<{ consomme: number; reserve: number; plafond: number }>(
      'SELECT consomme_millioniemes AS consomme, reserve_millioniemes AS reserve, plafond_millioniemes AS plafond FROM budget_ia',
    )
    return rows[0]
  }
  const compter = async (table: string) => {
    const { rows } = await bases.pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`)
    return Number(rows[0]?.n)
  }

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    dossier = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    const base = baseDepuisPool(bases.db, bases.pool)
    const hacheur = creerHacheur(4)
    userId = nouvelId(Date.parse('2026-09-01T10:00:00.000Z'))
    await bases.db.insert(t.users).values({
      id: userId,
      nomUtilisateur: 'amine',
      motDePasseHash: await hacheur.hacher(MOT_DE_PASSE),
      reglages: Reglages.parse({}),
      creeLe: '2026-09-01T10:00:00.000Z',
    })
    s = await serveurDeTest({
      base,
      proprietaire: base,
      hacheur,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
      correcteur: faux,
      hasard: () => hasardCourant,
    })
    const importation = monterImportation(base, s.horloge, dossier)
    await importation.importerCatalogue(CATALOGUE)
    await importation.importerFiche(await readFile(FICHE_DEMO, 'utf8'))
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`
  })
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  it('exige une connexion', async () => {
    expect((await corriger(demande(), s, false)).statusCode).toBe(401)
  })

  it('corrige, garde la correction avec la consigne, le coût et le brut, et recalcule le bloc', async () => {
    const corps = demande()

    const reponse = await corriger(corps)

    expect(reponse.statusCode).toBe(200)
    expect(reponse.json()).toMatchObject({
      id: corps.id,
      question: 'R1',
      tour: 1,
      niveau: expect.any(String) as unknown,
      source: 'deduit',
      certitude: 'sur',
      compte: true,
      echantillon: false,
    })
    const { rows } = await bases.pool.query<{
      modele: string
      cout: number
      consigne: string
      brut: string
    }>(
      'SELECT modele, cout_millioniemes AS cout, consigne_empreinte AS consigne, brut FROM corrections WHERE id = $1',
      [corps.id],
    )
    expect(rows[0]).toMatchObject({ modele: 'faux', cout: 540 })
    expect(rows[0]?.consigne).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.parse(rows[0]?.brut ?? '')).toMatchObject({ source: 'deduit' })
    expect(await compter('statuts_courants')).toBe(1)
    expect(await budget()).toMatchObject({ consomme: 540, reserve: 0 })
  })

  it('rend la correction gardée pour un doublon, sans rappeler le correcteur ni payer deux fois', async () => {
    const corps = demande()
    const premiere = await corriger(corps)
    const appels = faux.requetes.length
    const consomme = (await budget())?.consomme

    const doublon = await corriger(corps)

    expect(doublon.json()).toEqual(premiere.json())
    expect(faux.requetes).toHaveLength(appels)
    expect((await budget())?.consomme).toBe(consomme)
  })

  it('répond 404 pour une question ou un bloc inconnus', async () => {
    expect((await corriger(demande({ question: 'R99' }))).statusCode).toBe(404)
    expect((await corriger(demande({ bloc: 'D99' }))).statusCode).toBe(404)
    expect((await corriger(demande({ version: 9 }))).statusCode).toBe(404)
  })

  it('ne corrige pas encore les séries rappel et verification (400)', async () => {
    const { id, serie, tentative, question, reponse, confiance, relance, support } = demande({
      serie: 'rappel',
    })
    const sansBloc = { id, serie, tentative, question, reponse, confiance, relance, support }

    expect((await corriger(sansBloc)).statusCode).toBe(400)
  })

  it('la première réponse sans support compte ; avec support, recopiée ou relance, elle ne compte pas', async () => {
    const colle = await corriger(demande({ support: { colle: true, retour_cours: false } }))
    const cours = await corriger(demande({ support: { colle: false, retour_cours: true } }))
    const { rows } = await bases.pool.query<{ cours: string }>(
      "SELECT manifeste->>'contexte_ia' AS cours FROM fiches_versions",
    )
    const recopiee = await corriger(demande({ reponse: rows[0]?.cours ?? '' }))

    expect(colle.json()).toMatchObject({ compte: false, raison_non_compte: 'avec_support' })
    expect(cours.json()).toMatchObject({ compte: false, raison_non_compte: 'avec_support' })
    expect(recopiee.json()).toMatchObject({ compte: false, raison_non_compte: 'recopiee' })
  })

  it('une certitude « non vérifiée » ne compte pas', async () => {
    scenario = () =>
      JSON.stringify({
        message: 'Voici un retour détaillé sur ta réponse, qui reprend tes mots justes. '.repeat(3),
        niveau: 'partiel',
        erreurs_critiques: [],
        source: 'ajoute',
        ref: '',
        certitude: 'non_verifie',
      })

    const reponse = await corriger(demande())
    scenario = undefined

    expect(reponse.json()).toMatchObject({ compte: false, raison_non_compte: 'non_verifiee' })
  })

  it('une relance garde la tentative, passe au tour suivant, ne compte jamais et rejoue l’historique', async () => {
    const premier = demande()
    await corriger(premier)

    const relance = await corriger({
      ...premier,
      id: identifiant(),
      relance: 'Je reprends : une fiche résume un bloc.',
      reponse: 'Je reprends : une fiche résume un bloc.',
    })

    expect(relance.json()).toMatchObject({ tour: 2, compte: false, raison_non_compte: 'relance' })
    const derniere = faux.requetes.at(-1)
    expect(derniere?.historique).toHaveLength(1)
    expect(derniere?.historique[0]?.reponse).toBe(REPONSE_LONGUE)
  })

  it('refuse un premier tour de plus sur la même tentative (409) et une cinquième relance (422)', async () => {
    const premier = demande()
    await corriger(premier)
    expect((await corriger({ ...premier, id: identifiant() })).statusCode).toBe(409)

    for (let rang = 1; rang <= 4; rang += 1) {
      const relance = await corriger({
        ...premier,
        id: identifiant(),
        relance: `relance ${String(rang)}`,
      })
      expect(relance.statusCode).toBe(200)
    }
    const cinquieme = await corriger({ ...premier, id: identifiant(), relance: 'encore une' })

    expect(cinquieme.statusCode).toBe(422)
  })

  it('une contestation marque la correction et ajoute le fait « correction contestée »', async () => {
    const premier = demande({ question: 'R4' })
    const precedente = await corriger(premier)
    const contestee = await corriger({
      ...premier,
      id: identifiant(),
      relance: 'Je ne suis pas d’accord.',
      conteste: true,
    })

    expect(contestee.statusCode).toBe(200)
    const { rows } = await bases.pool.query<{ donnees: { correction: string } }>(
      "SELECT donnees FROM evenements WHERE type = 'correction_contestee'",
    )
    expect(rows.map(({ donnees }) => donnees.correction)).toContain(
      precedente.json<{ id: string }>().id,
    )
    const { rows: marquees } = await bases.pool.query<{ conteste: boolean }>(
      'SELECT conteste FROM corrections WHERE id = $1',
      [contestee.json<{ id: string }>().id],
    )
    expect(marquees[0]?.conteste).toBe(true)
  })

  it('refuse de contester quand rien n’a été corrigé (400)', async () => {
    const reponse = await corriger(demande({ question: 'R2', conteste: true, relance: 'non' }))

    expect(reponse.statusCode).toBe(400)
  })

  it('tire l’échantillon sur le premier tour seulement', async () => {
    hasardCourant = 0
    const tire = await corriger(demande())
    const relance = await corriger({ ...demande(), relance: 'oui', id: identifiant() })
    hasardCourant = 0.99
    const pasTire = await corriger(demande())
    hasardCourant = 0.5

    expect(tire.json<{ echantillon: boolean }>().echantillon).toBe(true)
    expect(relance.json<{ echantillon: boolean }>().echantillon).toBe(false)
    expect(pasTire.json<{ echantillon: boolean }>().echantillon).toBe(false)
  })

  it('écarte les erreurs critiques que le manifeste ne connaît pas', async () => {
    scenario = () =>
      JSON.stringify({
        message: 'Voici un retour détaillé sur ta réponse, qui reprend tes mots justes. '.repeat(3),
        niveau: 'fragile',
        erreurs_critiques: ['E1', 'E99'],
        source: 'deduit',
        ref: '',
        certitude: 'sur',
      })

    const reponse = await corriger(demande())
    scenario = undefined

    expect(reponse.json<{ erreurs_critiques: string[] }>().erreurs_critiques).toEqual(['E1'])
  })

  describe('quand le JSON est invalide', () => {
    it('refait un seul essai, avec le rappel du JSON, et garde le second résultat', async () => {
      const avant = faux.requetes.length
      scenario = (_requete, appel) => (appel === avant + 1 ? 'pas du json' : undefined)

      const reponse = await corriger(demande())
      scenario = undefined

      expect(reponse.statusCode).toBe(200)
      expect(faux.requetes.slice(avant).map(({ strict }) => strict)).toEqual([false, true])
    })

    it('deux fois de suite : « Correction indisponible » (503), réponses brutes gardées, coût payé, réservation rendue', async () => {
      const corps = demande()
      const echecsAvant = await compter('corrections_echecs')
      const consommeAvant = (await budget())?.consomme ?? 0
      scenario = () => 'pas du json'

      const reponse = await corriger(corps)
      scenario = undefined

      expect(reponse.statusCode).toBe(503)
      expect(reponse.json()).toMatchObject({ title: 'Correction indisponible' })
      expect(await compter('corrections_echecs')).toBe(echecsAvant + 1)
      const { rows } = await bases.pool.query<{ bruts: string[]; cout: number }>(
        'SELECT bruts, cout_millioniemes AS cout FROM corrections_echecs WHERE id = $1',
        [corps.id],
      )
      expect(rows[0]?.bruts).toEqual(['pas du json', 'pas du json'])
      expect(rows[0]?.cout).toBe(1080)
      expect(await budget()).toMatchObject({ consomme: consommeAvant + 1080, reserve: 0 })
    })

    it('une panne du fournisseur deux fois donne aussi 503, sans coût', async () => {
      const consommeAvant = (await budget())?.consomme ?? 0
      scenario = () => new Error('en panne')

      const reponse = await corriger(demande())
      scenario = undefined

      expect(reponse.statusCode).toBe(503)
      expect(await budget()).toMatchObject({ consomme: consommeAvant, reserve: 0 })
    })

    it('un message avec un mot de statut est refusé comme un JSON invalide', async () => {
      scenario = () =>
        JSON.stringify({
          message:
            'Ta réponse est complète, ce bloc est acquis, tu peux avancer sereinement. '.repeat(3),
          niveau: 'solide',
          erreurs_critiques: [],
          source: 'deduit',
          ref: '',
          certitude: 'sur',
        })

      const reponse = await corriger(demande())
      scenario = undefined

      expect(reponse.statusCode).toBe(503)
    })
  })

  it('sans correcteur branché (pas de clé), la correction est indisponible (503)', async () => {
    const base = baseDepuisPool(bases.db, bases.pool)
    const sansCorrecteur = await serveurDeTest({
      base,
      proprietaire: base,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
    })

    const reponse = await corriger(demande(), sansCorrecteur)

    expect(reponse.statusCode).toBe(503)
  })

  describe('le budget', () => {
    it('refuse en 429 « budget_atteint » quand le plafond du mois serait dépassé, sans appeler le correcteur', async () => {
      await reglages({ plafondIaMillioniemes: 100 })
      const appels = faux.requetes.length

      const reponse = await corriger(demande())

      expect(reponse.statusCode).toBe(429)
      expect(reponse.json()).toMatchObject({ code: 'budget_atteint' })
      expect(faux.requetes).toHaveLength(appels)
      await reglages({})
    })

    it('dix demandes simultanées près du plafond ne le dépassent jamais', async () => {
      const { rows } = await bases.pool.query<{ consomme: number }>(
        'SELECT consomme_millioniemes AS consomme FROM budget_ia',
      )
      const consommeAvant = rows[0]?.consomme ?? 0
      const plafond = consommeAvant + 9_000
      await reglages({ plafondIaMillioniemes: plafond })

      const reponses = await Promise.all(Array.from({ length: 10 }, () => corriger(demande())))

      const codes = reponses.map(({ statusCode }) => statusCode)
      const reussies = codes.filter((code) => code === 200).length
      expect(codes.every((code) => code === 200 || code === 429)).toBe(true)
      expect(reussies).toBeGreaterThan(0)
      expect(reussies).toBeLessThan(10)
      const apres = await budget()
      expect(apres?.reserve).toBe(0)
      expect(apres?.consomme).toBe(consommeAvant + 540 * reussies)
      expect(apres?.consomme).toBeLessThanOrEqual(plafond)
      await reglages({})
    })

    it('limite le nombre d’appels par heure (429, trop_de_requetes)', async () => {
      await reglages({ appelsIaParHeure: 1 })

      const reponse = await corriger(demande())

      expect(reponse.statusCode).toBe(429)
      expect(reponse.json()).toMatchObject({ code: 'trop_de_requetes' })
      await reglages({})
    })
  })
})
