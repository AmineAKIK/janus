import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
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

interface Tableau {
  modules: { id: string; titre: string }[]
  module: { id: string; titre: string } | null
  periode: string
  blocs: { bloc: string; partie: string; statut: string; titre_court: string }[]
  a_faire: { aujourdhui: number; a_venir: number; taches: { tache: { type: string } }[] }
  mesures: {
    retention: { cartes: { total: number } }[]
    temps: { total_s: number; blocs: { bloc: string; secondes: number }[] }
    fiabilite: { contestations: number }
  }
  cout_ia: { depense_millioniemes: number; plafond_millioniemes: number }
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('GET /tableau-de-bord contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse('2026-10-03T10:00:00.000Z') + (sequence += 1))

  const lire = async (requete = '') => {
    const reponse = await s.app.inject({
      method: 'GET',
      url: `/api/tableau-de-bord${requete}`,
      headers: { cookie },
    })
    return { statusCode: reponse.statusCode, corps: reponse.json<Tableau>() }
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
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  it('exige une connexion', async () => {
    expect((await s.app.inject({ method: 'GET', url: '/api/tableau-de-bord' })).statusCode).toBe(
      401,
    )
  })

  it('sans rien de fait : le premier module, ses blocs, une tâche, des mesures vides', async () => {
    const { statusCode, corps } = await lire()

    expect(statusCode).toBe(200)
    expect(corps.modules).toEqual([{ id: 'M1', titre: 'Les bases' }])
    expect(corps.module).toEqual({ id: 'M1', titre: 'Les bases' })
    expect(corps.periode).toBe('30j')
    expect(corps.blocs).toEqual([
      expect.objectContaining({ bloc: 'D01', partie: 'P1 Démarrer', statut: 'non_commence' }),
    ])
    expect(corps.a_faire).toMatchObject({ aujourdhui: 1, a_venir: 0 })
    expect(corps.a_faire.taches.map(({ tache }) => tache.type)).toEqual(['bloc'])
    expect(corps.mesures.retention).toHaveLength(4)
    expect(corps.mesures.temps.total_s).toBe(0)
    expect(corps.cout_ia.depense_millioniemes).toBe(0)
    expect(corps.cout_ia.plafond_millioniemes).toBe(Reglages.parse({}).plafondIaMillioniemes)
  })

  it('prend la période et le module demandés, refuse une période inconnue', async () => {
    expect((await lire('?periode=7j')).corps.periode).toBe('7j')
    const inconnu = await lire('?module=ZZ')
    expect(inconnu.corps.module).toBeNull()
    expect(inconnu.corps.blocs).toEqual([])
    expect((await lire('?periode=an')).statusCode).toBe(400)
  })

  it('compte les cartes notées, le temps actif et le coût des corrections', async () => {
    await bases.db.insert(t.evenements).values({
      id: identifiant(),
      userId,
      blocId,
      ficheVersionId,
      type: 'temps.actif',
      donnees: { secondes: 120, etape: 'pratique' },
      empreinte: 'e'.repeat(64),
      aide: null,
      dateServeur: s.horloge.maintenant(),
    })
    const [carte] = await bases.db.select({ id: t.cartes.id }).from(t.cartes).limit(1)
    await bases.db.insert(t.notesCartes).values({
      id: identifiant(),
      userId,
      carteId: carte?.id ?? '',
      note: 'bien',
      dateServeur: s.horloge.maintenant(),
    })
    const correction = await s.app.inject({
      method: 'POST',
      url: '/api/corrections',
      headers: { cookie, origin: ORIGINE_TEST },
      payload: {
        id: identifiant(),
        serie: 'restitution',
        tentative: 1,
        question: 'R1',
        reponse: REPONSE_LONGUE,
        confiance: 'sur',
        relance: '',
        support: { colle: false, retour_cours: false },
        bloc: 'D01',
        version: 1,
      },
    })
    expect(correction.statusCode).toBe(200)

    const { corps } = await lire()

    expect(corps.mesures.temps.total_s).toBe(120)
    expect(corps.mesures.temps.blocs).toEqual([{ bloc: 'D01', titre_court: 'Démo', secondes: 120 }])
    expect(corps.mesures.retention.reduce((n, semaine) => n + semaine.cartes.total, 0)).toBe(1)
    expect(corps.cout_ia.depense_millioniemes).toBeGreaterThan(0)
  })
})
