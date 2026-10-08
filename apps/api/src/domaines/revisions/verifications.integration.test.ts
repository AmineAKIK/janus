import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { ajouterJours, jourDe } from '@janus/moteur'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
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
      correcteur: creerFaux(() => undefined),
    })
    service = creerServiceRevisions({ base, depot: creerDepotRevisions(), horloge: s.horloge })
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
})
