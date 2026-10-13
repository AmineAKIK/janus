import { nouvelId } from '@janus/contrats'
import { drizzle } from 'drizzle-orm/node-postgres'
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
  const autreFicheVersionId = id()
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
    await base.db.insert(t.fichesVersions).values([
      {
        id: ficheVersionId,
        blocId,
        version: 1,
        empreinte: HASH,
        chemin: 'B01/x.html',
        manifeste: {},
        creeLe: DATE,
      },
      {
        id: autreFicheVersionId,
        blocId: autreBlocId,
        version: 1,
        empreinte: HASH,
        chemin: 'B02/x.html',
        manifeste: {},
        creeLe: DATE,
      },
    ])
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
      ficheVersionId:
        (surcharge.blocId ?? blocId) === autreBlocId ? autreFicheVersionId : ficheVersionId,
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

  describe('lecture réduite', () => {
    /** Une lecture qui note chaque requête SQL envoyée à PostgreSQL. */
    function lecteurQuiNote() {
      const requetes: string[] = []
      const db = drizzle(base.pool, {
        schema: t,
        logger: { logQuery: (requete) => requetes.push(requete) },
      })
      return { db, requetes }
    }
    const trie = <T extends { id: string }>(faits: readonly T[]) =>
      [...faits].sort((a, b) => a.id.localeCompare(b.id))

    it('ne demande pas à PostgreSQL les événements que le moteur ignore (temps actif, réponses du pré-test…)', async () => {
      await evenement('temps.actif', { secondes: 60 })
      await evenement('pretest.reponse', { question: 'P1' })
      const { db, requetes } = lecteurQuiNote()

      const faits = await lireFaits(db, userId, [cible])

      const evenements = requetes.filter((texte) => texte.includes('from "evenements"'))
      expect(evenements).toHaveLength(1)
      expect(evenements[0]).toContain('"evenements"."type" in (')
      expect(faits.map(({ type }) => type)).not.toContain('temps.actif')
    })

    it('rend, parmi les faits de toujours, ceux des types demandés et seulement ceux-là', async () => {
      const tous = await lireFaits(base.db, userId, [cible])
      const types = new Set(tous.map(({ type }) => type))
      expect(types.size).toBeGreaterThanOrEqual(7)
      for (const type of types) {
        const seul = await lireFaits(base.db, userId, [cible], [type])
        expect(trie(seul)).toEqual(trie(tous.filter((fait) => fait.type === type)))
      }
      const melange = ['etape_vue', 'correction', 'erreur_cochee', 'force_levee'] as const
      expect(trie(await lireFaits(base.db, userId, [cible], melange))).toEqual(
        trie(tous.filter(({ type }) => (melange as readonly string[]).includes(type))),
      )
      expect(await lireFaits(base.db, userId, [cible], [])).toEqual([])
    })

    it('ne lit que les tables qui portent les types demandés', async () => {
      const cas: [
        readonly ('etape_vue' | 'correction' | 'statut_force' | 'erreur_cochee')[],
        string[],
      ][] = [
        [['etape_vue'], ['evenements']],
        [['correction'], ['corrections']],
        [['statut_force'], ['statuts_forces']],
        [['erreur_cochee'], ['decisions_erreurs']],
        [
          ['etape_vue', 'correction'],
          ['evenements', 'corrections'],
        ],
      ]
      for (const [types, tables] of cas) {
        const { db, requetes } = lecteurQuiNote()
        await lireFaits(db, userId, [cible], types)
        const lues = ['evenements', 'corrections', 'statuts_forces', 'decisions_erreurs'].filter(
          (table) => requetes.some((texte) => texte.includes(`from "${table}"`)),
        )
        expect(lues).toEqual(tables)
      }
    })
  })
})
