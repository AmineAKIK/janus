import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { ajouterJours, jourDe } from '@janus/moteur'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import type { Scenario } from '../../adaptateurs/correcteur/faux.ts'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'
import { monterImportation } from '../catalogue/composition.ts'
import { creerDepotRevisions } from './depot.ts'
import { creerServiceRevisions } from './service.ts'

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
const HASH = createHash('sha256').update('test').digest('hex')

describe.skipIf(URL_SERVEUR_TEST === undefined)('vérifications contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let service: ReturnType<typeof creerServiceRevisions>
  let cookie = ''
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  let scenario: Scenario | undefined
  const identifiant = () => nouvelId(Date.parse('2026-10-03T10:00:00.000Z') + (sequence += 1))

  const lire = (id: string) =>
    s.app.inject({ method: 'GET', url: `/api/verifications/${id}`, headers: { cookie } })
  const reporter = (id: string, corps: Record<string, unknown>) =>
    s.app.inject({
      method: 'POST',
      url: `/api/verifications/${id}/reporter`,
      headers: { cookie, origin: ORIGINE_TEST },
      payload: corps,
    })

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
      correcteur: creerFaux((requete, appel) => scenario?.(requete, appel)),
    })
    service = creerServiceRevisions({
      base,
      depot: creerDepotRevisions(),
      horloge: s.horloge,
      corrigerPartie: () => Promise.reject(new Error('inutilisé')),
    })
    const importation = monterImportation(base, s.horloge, dossier)
    await importation.importerCatalogue(CATALOGUE)
    await importation.importerFiche(await readFile(FICHE_DEMO, 'utf8'))
    const [bloc] = await bases.db.select({ id: t.blocs.id }).from(t.blocs)
    blocId = bloc?.id ?? ''
    const [version] = await bases.db.select({ id: t.fichesVersions.id }).from(t.fichesVersions)
    ficheVersionId = version?.id ?? ''
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

  it('exige une connexion et ignore une vérification inconnue', async () => {
    const inconnue = identifiant()

    expect(
      (await s.app.inject({ method: 'GET', url: `/api/verifications/${inconnue}` })).statusCode,
    ).toBe(401)
    expect((await lire(inconnue)).statusCode).toBe(404)
    expect((await reporter(inconnue, { id: identifiant() })).statusCode).toBe(404)
  })

  it('tire une fois la vérification ouverte d’un bloc et ne dévoile ni son code ni son titre', async () => {
    const id = await service.verificationPour(userId, 'D01', 'verification')
    const encore = await service.verificationPour(userId, 'D01', 'verification')
    const autreType = await service.verificationPour(userId, 'D01', 'retest')

    expect(encore).toBe(id)
    expect(autreType).not.toBe(id)
    const reponse = await lire(id)
    expect(reponse.statusCode).toBe(200)
    const corps = reponse.json<{
      type: string
      terminee: boolean
      resultat: unknown
      parties: { id: string; type: string; envoyee: boolean }[]
    }>()
    expect(corps).toMatchObject({ type: 'verification', terminee: false, resultat: null })
    expect(corps.parties.map(({ type }) => type)).toEqual(['explication', 'tache', 'transfert'])
    expect(corps.parties.every(({ envoyee }) => !envoyee)).toBe(true)
    const texte = JSON.stringify(corps)
    expect(texte).not.toContain('D01')
    expect(texte).not.toContain('attendu')
    const [titre] = await bases.db
      .select({ titre: t.fichesVersions.manifeste })
      .from(t.fichesVersions)
    expect(texte).not.toContain(JSON.stringify(titre?.titre).slice(1, 10))
  })

  it('rend la vérification à l’identique quand on la rouvre', async () => {
    const id = await service.verificationPour(userId, 'D01', 'verification')

    expect((await lire(id)).json()).toEqual((await lire(id)).json())
  })

  it('signale une page ouverte dans les dernières heures', async () => {
    const id = await service.verificationPour(userId, 'D01', 'verification')
    expect((await lire(id)).json<{ revu_recemment: unknown }>().revu_recemment).toBeNull()

    await bases.db.insert(t.evenements).values({
      id: identifiant(),
      userId,
      blocId,
      ficheVersionId,
      type: 'bloc_ouvert',
      donnees: { horsPrerequis: false },
      empreinte: HASH,
      aide: null,
      dateServeur: s.horloge.maintenant(),
    })

    expect((await lire(id)).json<{ revu_recemment: unknown }>().revu_recemment).toBe('aujourdhui')
  })

  it('reporte à demain, rejoue le même message sans rien changer, refuse une vérification terminée', async () => {
    const id = await service.verificationPour(userId, 'D01', 'retest')
    const reglages = Reglages.parse({})
    const demain = ajouterJours(
      jourDe(s.horloge.maintenant(), reglages.fuseau, reglages.heureBascule),
      1,
    )
    const message = { id: identifiant() }

    const premiere = await reporter(id, message)
    const seconde = await reporter(id, message)

    expect(premiere.json()).toEqual({ due_le: demain })
    expect(seconde.json()).toEqual({ due_le: demain })
    expect((await lire(id)).json<{ due_le: string }>().due_le >= demain).toBe(true)
    const { rows } = await bases.pool.query<{ n: string }>(
      "SELECT count(*) AS n FROM evenements WHERE type = 'verification_reportee'",
    )
    expect(Number(rows[0]?.n ?? 0)).toBe(1)

    await bases.db.insert(t.evenements).values({
      id: identifiant(),
      userId,
      blocId,
      ficheVersionId,
      type: 'verification_resultat',
      donnees: {
        verification: id,
        resultat: {
          bloc: { code: 'D01', titre: 'Titre' },
          issue: 'reussie',
          valable: true,
          statut_avant: 'vu',
          statut: 'vu',
          descend: false,
          prochaine: null,
          parties: [],
          erreur_a_confirmer: null,
        },
      },
      empreinte: HASH,
      aide: null,
      dateServeur: s.horloge.maintenant(),
    })

    expect((await reporter(id, { id: identifiant() })).statusCode).toBe(409)
    const terminee = (await lire(id)).json<{
      terminee: boolean
      resultat: { bloc: { code: string } }
    }>()
    expect(terminee.terminee).toBe(true)
    expect(terminee.resultat.bloc.code).toBe('D01')
    // Une vérification terminée n'est plus « ouverte » : la suivante est un nouveau tirage.
    expect(await service.verificationPour(userId, 'D01', 'retest')).not.toBe(id)
  })

  describe('réponses et résultat', () => {
    const REPONSE_LONGUE =
      'Une fiche résume un seul bloc de cours avec ses exercices et son bilan, comme un petit guide.'
    type Partie = { id: string; type: string }
    type Sortie = {
      partie: string
      terminee: boolean
      resultat?: {
        bloc: { code: string }
        issue: string
        valable: boolean
        raison_invalide?: string
        prochaine: { type: string; apres: string } | null
        parties: { id: string }[]
        erreur_a_confirmer: { erreur: string; correction: string } | null
      }
    }
    const repondre = (id: string, corps: Record<string, unknown>) =>
      s.app.inject({
        method: 'POST',
        url: `/api/verifications/${id}/reponses`,
        headers: { cookie, origin: ORIGINE_TEST },
        payload: corps,
      })
    const corps = (partie: Partie, surcharge: Record<string, unknown> = {}) => ({
      id: identifiant(),
      partie: partie.id,
      reponse: partie.type === 'tache' ? 'FICHE' : REPONSE_LONGUE,
      confiance: 'sur',
      support: { colle: false, retour_cours: false },
      ...surcharge,
    })
    const parties = async (id: string) => (await lire(id)).json<{ parties: Partie[] }>().parties
    const MESSAGE_LONG = `${'Ta réponse laisse penser que tu confonds deux notions du cours. '.repeat(4)}Relis le point concerné.`

    it('ne montre aucune correction avant la dernière partie, puis rend le résultat', async () => {
      await bases.pool.query("DELETE FROM evenements WHERE type = 'bloc_ouvert'")
      const id = await service.verificationPour(userId, 'D01', 'entretien')
      const [premiere, deuxieme, troisieme] = await parties(id)
      if (premiere === undefined || deuxieme === undefined || troisieme === undefined) {
        throw new Error('trois parties attendues')
      }

      const un = await repondre(id, corps(premiere))
      const deux = await repondre(id, corps(deuxieme))

      expect(un.json()).toEqual({ partie: premiere.id, terminee: false })
      expect(deux.json()).toEqual({ partie: deuxieme.id, terminee: false })
      expect(JSON.stringify([un.json(), deux.json()])).not.toContain('D01')
      const enCours = (await lire(id)).json<{
        parties: { envoyee: boolean }[]
        resultat: unknown
      }>()
      expect(enCours.parties.map(({ envoyee }) => envoyee)).toEqual([true, true, false])
      expect(enCours.resultat).toBeNull()

      const dernier = corps(troisieme)
      const fin = await repondre(id, dernier)

      expect(fin.statusCode).toBe(200)
      const sortie = fin.json<Sortie>()
      expect(sortie.terminee).toBe(true)
      expect(sortie.resultat).toMatchObject({ bloc: { code: 'D01' }, valable: true })
      expect(sortie.resultat?.parties).toHaveLength(3)
      expect(sortie.resultat?.erreur_a_confirmer).toBeNull()
      expect((await lire(id)).json<{ terminee: boolean }>().terminee).toBe(true)
      // Rejouer le dernier message rend le même résultat, sans second fait.
      expect((await repondre(id, dernier)).json()).toEqual(sortie)
      const { rows } = await bases.pool.query<{ n: string }>(
        "SELECT count(*) AS n FROM evenements WHERE type = 'verification_terminee'",
      )
      expect(Number(rows[0]?.n ?? 0)).toBe(1)
      const { rows: corrections } = await bases.pool.query<{ n: string }>(
        "SELECT count(*) AS n FROM corrections WHERE serie = 'verification'",
      )
      expect(Number(corrections[0]?.n ?? 0)).toBe(2)
    })

    it('une réponse avec support ne compte pas : vérification non valable, nouvel essai demain', async () => {
      const id = await service.verificationPour(userId, 'D01', 'verification')
      const toutes = await parties(id)
      let derniere: Sortie | undefined
      for (const partie of toutes) {
        const surcharge =
          partie.type === 'tache' ? { support: { colle: true, retour_cours: false } } : {}
        derniere = (await repondre(id, corps(partie, surcharge))).json<Sortie>()
      }

      expect(derniere?.resultat).toMatchObject({ valable: false, raison_invalide: 'avec_support' })
      expect(derniere?.resultat?.prochaine?.type).toBe('verification')
    })

    it('propose une erreur à confirmer quand la correction en relève une', async () => {
      scenario = () =>
        JSON.stringify({
          message: MESSAGE_LONG,
          niveau: 'partiel',
          erreurs_critiques: ['E1'],
          source: 'deduit',
          ref: '',
          certitude: 'sur',
        })
      const id = await service.verificationPour(userId, 'D01', 'retest')
      let derniere: Sortie | undefined
      for (const partie of await parties(id)) {
        derniere = (await repondre(id, corps(partie))).json<Sortie>()
      }
      scenario = undefined

      expect(derniere?.resultat?.issue).toBe('a_examiner')
      expect(derniere?.resultat?.erreur_a_confirmer).toMatchObject({ erreur: 'E1' })
    })

    it('refuse une partie inconnue (404), une réponse vide (400) et rend 503 sans correcteur disponible', async () => {
      const id = await service.verificationPour(userId, 'D01', 'entretien')
      const [premiere] = await parties(id)
      if (premiere === undefined) throw new Error('aucune partie')

      expect((await repondre(id, { ...corps(premiere), partie: 'INCONNUE' })).statusCode).toBe(404)
      expect((await repondre(id, { ...corps(premiere), reponse: '' })).statusCode).toBe(400)
      scenario = () => new Error('panne')
      const explication = (await parties(id)).find(({ type }) => type === 'explication')
      if (explication === undefined) throw new Error('aucune explication')
      expect((await repondre(id, corps(explication))).statusCode).toBe(503)
      scenario = undefined
      expect((await lire(id)).json<{ parties: { envoyee: boolean }[] }>().parties[0]?.envoyee).toBe(
        false,
      )
    })
  })
})
