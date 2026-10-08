import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { ecrireFait } from '../../base/ecrireFait.ts'
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

type Tache = { tache: { type: string; bloc?: string }; lien: string; faite: boolean }
type Aujourdhui = {
  jour: string
  en_retard: boolean
  retour?: { jours: number }
  premiere_connexion: boolean
  taches: Tache[]
  module: { id: string; titre: string; blocs: { bloc: string; statut: string }[] } | null
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('GET /aujourdhui contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse('2026-10-03T10:00:00.000Z') + (sequence += 1))

  const lire = async () => {
    const reponse = await s.app.inject({
      method: 'GET',
      url: '/api/aujourdhui',
      headers: { cookie },
    })
    if (reponse.statusCode !== 200) throw new Error(reponse.body)
    return reponse.json<Aujourdhui>()
  }
  const forcer = (statut: string) =>
    bases.db.insert(t.statutsForces).values({
      id: identifiant(),
      userId,
      blocId,
      dateServeur: s.horloge.maintenant(),
      action: 'forcer',
      statut,
      raison: 'test',
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
      correcteur: creerFaux(() => undefined),
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
  /** Avance l'horloge, puis se reconnecte : la session ne dure pas des mois. */
  const placer = async (instant: string) => {
    s.horloge.placer(instant)
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`
  }
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  it('exige une connexion', async () => {
    expect((await s.app.inject({ method: 'GET', url: '/api/aujourdhui' })).statusCode).toBe(401)
  })

  it('à la première connexion : commencer le premier bloc, et le module en cours', async () => {
    const jour = await lire()

    expect(jour.premiere_connexion).toBe(true)
    expect(jour.en_retard).toBe(false)
    expect(jour.retour).toBeUndefined()
    expect(jour.taches).toEqual([
      { tache: { type: 'bloc', bloc: 'D01' }, lien: '/blocs/D01', faite: false },
    ])
    expect(jour.module).toMatchObject({
      id: 'M1',
      titre: 'Les bases',
      blocs: [{ bloc: 'D01', statut: 'non_commence' }],
    })
  })

  it('un bloc vu ouvre les questions de début et les cartes, dans l’ordre du moteur', async () => {
    await forcer('vu')

    const jour = await lire()

    expect(jour.premiere_connexion).toBe(false)
    const types = jour.taches.map(({ tache }) => tache.type)
    expect(types.indexOf('questions_debut')).toBeGreaterThanOrEqual(0)
    expect(types.indexOf('questions_debut')).toBeLessThan(types.indexOf('cartes'))
    const liens = Object.fromEntries(jour.taches.map(({ tache, lien }) => [tache.type, lien]))
    expect(liens['questions_debut']).toBe('/questions')
    expect(liens['cartes']).toBe('/revision')
    expect(jour.module?.blocs).toEqual([expect.objectContaining({ bloc: 'D01', statut: 'vu' })])
  })

  it('après sept jours sans activité : en retard, avec le nombre de jours de pause', async () => {
    await placer('2027-03-01T10:00:00.000Z')

    const jour = await lire()

    expect(jour.en_retard).toBe(true)
    expect(jour.retour?.jours).toBeGreaterThanOrEqual(7)
    expect(ficheVersionId).not.toBe('')
  })
})

// Un bloc « acquis provisoirement » sans vérification faite : la vérification est due.
const CAS_VERIFICATION_DUE = CAS_ACCEPTATION.find(
  (cas): cas is CasStatut =>
    cas.genre === 'statut' &&
    cas.situation === 'Vérification à J+3 réussie, page du bloc ouverte la veille',
)

describe.skipIf(URL_SERVEUR_TEST === undefined || CAS_VERIFICATION_DUE === undefined)(
  'GET /aujourdhui avec une vérification due',
  () => {
    let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
    let s: Awaited<ReturnType<typeof serveurDeTest>>
    let cookie = ''
    let lien = ''
    let sequence = 0
    const identifiant = () => nouvelId(Date.parse('2026-06-01T10:00:00.000Z') + (sequence += 1))
    const lire = async () => {
      const reponse = await s.app.inject({
        method: 'GET',
        url: '/api/aujourdhui',
        headers: { cookie },
      })
      return reponse.json<Aujourdhui>()
    }

    beforeAll(async () => {
      const cas = CAS_VERIFICATION_DUE
      if (cas === undefined) return
      bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
      const base = baseDepuisPool(bases.db, bases.pool)
      const hacheur = creerHacheur(4)
      const userId = identifiant()
      await bases.db.insert(t.users).values({
        id: userId,
        nomUtilisateur: 'amine',
        motDePasseHash: await hacheur.hacher(MOT_DE_PASSE),
        reglages: cas.reglages,
        creeLe: '2026-05-01T10:00:00.000Z',
      })
      const formationId = identifiant()
      const moduleId = identifiant()
      const blocId = identifiant()
      const ficheVersionId = identifiant()
      await bases.db.insert(t.formations).values({ id: formationId, code: 'F', titre: 'F' })
      await bases.db
        .insert(t.modules)
        .values({ id: moduleId, formationId, code: 'M', titre: 'M', ordre: 1, importe: true })
      await bases.db
        .insert(t.blocs)
        .values({ id: blocId, moduleId, code: cas.manifeste.bloc, titre: 'B', ordre: 1 })
      await bases.db.insert(t.fichesVersions).values({
        id: ficheVersionId,
        blocId,
        version: 1,
        empreinte: 'e'.repeat(64),
        chemin: 'D01/x.html',
        manifeste: cas.manifeste,
        creeLe: '2026-05-01T10:00:00.000Z',
      })
      const ids = new Map<string, string>()
      let rang = 0
      for (const fait of cas.faits) {
        rang += 1
        await ecrireFait(
          { db: bases.db, userId, blocId, ficheVersionId, identifiant },
          fait,
          ids,
          rang,
        )
      }
      s = await serveurDeTest({
        base,
        proprietaire: base,
        hacheur,
        config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
        correcteur: creerFaux(() => undefined),
      })
      s.horloge.placer(cas.maintenant)
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
    })

    it('donne à la vérification due le lien de la vérification tirée, la même à chaque lecture', async () => {
      const due = (await lire()).taches.find(({ tache }) => tache.type === 'verification')

      expect(due?.lien).toMatch(/^\/verifications\/[0-9a-f-]{36}$/u)
      lien = due?.lien ?? ''
      expect((await lire()).taches.find(({ tache }) => tache.type === 'verification')?.lien).toBe(
        lien,
      )
      const ouverte = await s.app.inject({ method: 'GET', url: `/api${lien}`, headers: { cookie } })
      expect(ouverte.statusCode).toBe(200)
    })

    it('la retire de la file une fois reportée', async () => {
      const reportee = await s.app.inject({
        method: 'POST',
        url: `/api${lien}/reporter`,
        headers: { cookie, origin: ORIGINE_TEST },
        payload: { id: identifiant() },
      })

      expect(reportee.statusCode).toBe(200)
      expect((await lire()).taches.some(({ tache }) => tache.type === 'verification')).toBe(false)
    })
  },
)
