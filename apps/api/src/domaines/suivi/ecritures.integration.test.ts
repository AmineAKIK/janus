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
describe.skipIf(URL_SERVEUR_TEST === undefined)('écritures du journal contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse('2026-10-03T10:00:00.000Z') + (sequence += 1))

  const envoyer = (methode: 'POST' | 'PATCH', url: string, payload: Record<string, unknown>) =>
    s.app.inject({ method: methode, url, headers: { cookie, origin: ORIGINE_TEST }, payload })
  const entrees = async () =>
    (await s.app.inject({ method: 'GET', url: '/api/journal', headers: { cookie } })).json<{
      entrees: { id: string; note: { id: string; texte: string; date: string } | null }[]
    }>().entrees
  const ouvrir = (date: string) =>
    bases.db.insert(t.evenements).values({
      id: identifiant(),
      userId,
      blocId,
      ficheVersionId,
      type: 'bloc_ouvert',
      donnees: { horsPrerequis: false },
      empreinte: 'e'.repeat(64),
      aide: null,
      dateServeur: date,
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
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  it('exige une connexion', async () => {
    const reponse = await s.app.inject({
      method: 'POST',
      url: '/api/journal/idees',
      headers: { origin: ORIGINE_TEST },
      payload: { id: identifiant(), texte: 'x' },
    })
    expect(reponse.statusCode).toBe(401)
  })

  describe('notes', () => {
    let ligne = ''
    beforeAll(async () => {
      await ouvrir('2026-10-03T08:00:00.000Z')
      ligne = (await entrees())[0]?.id ?? ''
    })

    it('refuse une ligne inconnue (404)', async () => {
      const reponse = await envoyer('POST', '/api/journal/notes', {
        id: identifiant(),
        entree: 'inexistante',
        texte: 'a',
      })
      expect(reponse.statusCode).toBe(404)
    })

    it('ajoute une note, rejouée sans doublon ; une seconde note sur la ligne est refusée (409)', async () => {
      const id = identifiant()
      const corps = { id, entree: ligne, texte: 'ma note' }

      const premiere = await envoyer('POST', '/api/journal/notes', corps)
      const rejeu = await envoyer('POST', '/api/journal/notes', corps)
      const autre = await envoyer('POST', '/api/journal/notes', { ...corps, id: identifiant() })

      expect(premiere.statusCode).toBe(201)
      expect(premiere.json()).toMatchObject({ id, texte: 'ma note' })
      expect(rejeu.statusCode).toBe(201)
      expect(rejeu.json()).toEqual(premiere.json())
      expect(autre.statusCode).toBe(409)
      expect((await entrees())[0]?.note).toMatchObject({ id, texte: 'ma note' })
    })

    it('modifie en ajoutant une version, sans toucher à l’ancienne ni à la date', async () => {
      const [courante] = await entrees()
      const note = courante?.note
      if (note === undefined || note === null) throw new Error('aucune note')

      const reponse = await envoyer('PATCH', `/api/journal/notes/${note.id}`, { texte: 'corrigée' })

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json()).toMatchObject({ id: note.id, texte: 'corrigée', date: note.date })
      const { rows } = await bases.pool.query<{ texte: string }>(
        'SELECT texte FROM notes_journal WHERE note_id = $1',
        [note.id],
      )
      expect(rows.map(({ texte }) => texte).sort()).toEqual(['corrigée', 'ma note'])
      expect((await entrees())[0]?.note?.texte).toBe('corrigée')
    })

    it('refuse de modifier une note inconnue (404)', async () => {
      const reponse = await envoyer('PATCH', `/api/journal/notes/${identifiant()}`, { texte: 'x' })
      expect(reponse.statusCode).toBe(404)
    })
  })

  it('ajoute une idée, rejouée sans doublon', async () => {
    const corps = { id: identifiant(), texte: 'regarder les index' }

    const premiere = await envoyer('POST', '/api/journal/idees', corps)
    const rejeu = await envoyer('POST', '/api/journal/idees', corps)

    expect(premiere.statusCode).toBe(201)
    expect(rejeu.json()).toEqual(premiere.json())
    const { rows } = await bases.pool.query<{ n: string }>(
      'SELECT count(*) AS n FROM idees WHERE user_id = $1',
      [userId],
    )
    expect(Number(rows[0]?.n)).toBe(1)
  })

  it('enregistre une revue de la méthode (204), rejouée sans doublon', async () => {
    const corps = { id: identifiant(), texte: 'tout va bien' }

    const premiere = await envoyer('POST', '/api/revues-methode', corps)
    const rejeu = await envoyer('POST', '/api/revues-methode', corps)
    const sansTexte = await envoyer('POST', '/api/revues-methode', { id: identifiant() })

    expect(premiere.statusCode).toBe(204)
    expect(rejeu.statusCode).toBe(204)
    expect(sansTexte.statusCode).toBe(204)
    const { rows } = await bases.pool.query<{ n: string }>(
      'SELECT count(*) AS n FROM revues_methode WHERE user_id = $1',
      [userId],
    )
    expect(Number(rows[0]?.n)).toBe(2)
  })
})
