import { nouvelId } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lireFaits } from './faits.ts'
import * as t from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

const DATE = '2026-10-01T10:00:00.000Z'
const HASH = 'd'.repeat(64)
let numero = 0
const id = () => nouvelId(Date.parse(DATE) + (numero += 1))

describe.skipIf(URL_SERVEUR_TEST === undefined)('lecture des faits', () => {
  let base: Awaited<ReturnType<typeof creerBaseDeTest>>
  const userId = id()
  const autreId = id()
  const blocId = id()
  const autreBlocId = id()
  const ficheVersionId = id()
  const cible = { id: blocId, code: 'B01' }

  beforeAll(async () => {
    base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    for (const [identifiant, nom] of [
      [userId, 'amine'],
      [autreId, 'autre'],
    ] as const) {
      await base.db.insert(t.users).values({
        id: identifiant,
        nomUtilisateur: nom,
        motDePasseHash: 'h',
        reglages: {},
        creeLe: DATE,
      })
    }
    const formation = id()
    const module = id()
    await base.db.insert(t.formations).values({ id: formation, code: 'F', titre: 'F' })
    await base.db
      .insert(t.modules)
      .values({ id: module, formationId: formation, code: 'M', titre: 'M', ordre: 1 })
    await base.db.insert(t.blocs).values([
      { id: blocId, moduleId: module, code: 'B01', titre: 'B', ordre: 1 },
      { id: autreBlocId, moduleId: module, code: 'B02', titre: 'B', ordre: 2 },
    ])
    await base.db.insert(t.fichesVersions).values({
      id: ficheVersionId,
      blocId,
      version: 1,
      empreinte: HASH,
      chemin: 'B01/x.html',
      manifeste: {},
      creeLe: DATE,
    })
  })
  afterAll(async () => {
    await base.supprimer()
  })

  const evenement = (
    type: string,
    donnees: unknown,
    surcharge: { userId?: string; blocId?: string } = {},
  ) =>
    base.db.insert(t.evenements).values({
      id: id(),
      userId: surcharge.userId ?? userId,
      blocId: surcharge.blocId ?? blocId,
      ficheVersionId,
      type,
      donnees,
      empreinte: HASH,
      dateServeur: DATE,
    })

  it('ne rend rien sans bloc', async () => {
    expect(await lireFaits(base.db, userId, [])).toEqual([])
  })

  it('rend les faits des événements tels que le moteur les lit, avec le code du bloc et la date serveur', async () => {
    await evenement('bloc_ouvert', { horsPrerequis: true, raison: 'je connais' })
    await evenement('etape_vue', { etape: 'E1' })
    await evenement('pratique_resultat', { exercice: 'X1', item: 'i1', reussi: true, aide: 1 })
    await evenement('etape_vue', { etape: 'E9' }, { userId: autreId })
    await evenement('etape_vue', { etape: 'E8' }, { blocId: autreBlocId })
    await evenement('inconnu', { n: 1 })

    const faits = await lireFaits(base.db, userId, [cible])

    expect(faits.map(({ type }) => type).sort()).toEqual([
      'bloc_ouvert',
      'etape_vue',
      'pratique_resultat',
    ])
    expect(faits.find(({ type }) => type === 'bloc_ouvert')).toMatchObject({
      bloc: 'B01',
      date: DATE,
      horsPrerequis: true,
      raison: 'je connais',
    })
  })

  it('rend une correction, un forçage, sa levée et les décisions sur les erreurs', async () => {
    const correctionId = id()
    await base.db.insert(t.corrections).values({
      id: correctionId,
      userId,
      blocId,
      questionId: 'R1',
      serie: 'restitution',
      tentative: 1,
      tour: 1,
      confiance: 'sur',
      reponse: 'r',
      supportColle: false,
      supportRetourCours: false,
      recopiee: false,
      message: 'ok',
      niveau: 'partiel',
      erreursIds: ['ER1'],
      source: 'support',
      ref: 'R1',
      certitude: 'sur',
      compte: false,
      raisonNonCompte: 'relance',
      conteste: false,
      modele: 'm',
      parametres: {},
      jetonsEntree: 1,
      jetonsSortie: 1,
      coutMillioniemes: 1,
      consigneEmpreinte: HASH,
      dateServeur: DATE,
    })
    await base.db.insert(t.statutsForces).values([
      {
        id: id(),
        userId,
        blocId,
        action: 'forcer',
        statut: 'acquis',
        raison: 'je le sais',
        dateServeur: DATE,
      },
      { id: id(), userId, blocId, action: 'lever', dateServeur: DATE },
    ])
    await base.db.insert(t.decisionsErreurs).values([
      {
        id: id(),
        userId,
        blocId,
        erreurId: 'ER1',
        decision: 'cochee',
        source: 'amine',
        dateServeur: DATE,
      },
      {
        id: id(),
        userId,
        blocId,
        erreurId: 'ER1',
        decision: 'decochee',
        source: 'ia_confirmee',
        dateServeur: DATE,
      },
      {
        id: id(),
        userId,
        blocId,
        erreurId: 'ER1',
        decision: 'confirmee',
        correctionId,
        dateServeur: DATE,
      },
    ])

    const faits = await lireFaits(base.db, userId, [cible])

    const parType = (type: string) => faits.filter((fait) => fait.type === type)
    expect(parType('correction')).toEqual([
      {
        id: correctionId,
        bloc: 'B01',
        date: DATE,
        type: 'correction',
        serie: 'restitution',
        question: 'R1',
        tour: 1,
        niveau: 'partiel',
        compte: false,
        raisonNonCompte: 'relance',
        confiance: 'sur',
        erreursIa: ['ER1'],
      },
    ])
    expect(parType('statut_force')).toMatchObject([{ statut: 'acquis', raison: 'je le sais' }])
    expect(parType('force_levee')).toHaveLength(1)
    expect(parType('erreur_cochee')).toMatchObject([{ erreur: 'ER1', source: 'amine' }])
    expect(parType('erreur_decochee')).toMatchObject([{ source: 'ia_confirmee' }])
    expect(parType('erreur_ia_tranchee')).toMatchObject([
      { correction: correctionId, erreur: 'ER1', decision: 'confirmee' },
    ])
  })

  it('refuse une ligne que le schéma des faits ne lit pas, au lieu de l’ignorer', async () => {
    await evenement('etape_vue', { etape: 12 }, { blocId: autreBlocId })

    await expect(lireFaits(base.db, userId, [{ id: autreBlocId, code: 'B02' }])).rejects.toThrow()
  })
})
