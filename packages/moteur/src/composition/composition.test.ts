import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from '../fabrique.ts'
import { calculerBloc } from '../statut.ts'
import type { ResultatBloc } from '../statut.ts'
import type { BlocImporte } from './bloc.ts'
import { aisanceReussies, cinqPreuvesDuBloc, statutDuBloc } from './bloc.ts'
import { composerExport, composerJournal, ligneDuJournal } from './journal.ts'
import { composerTableau, PERIODE_PAR_DEFAUT } from './tableau.ts'

const MAINTENANT = apres(DEBUT, 400)
const MODULES = [
  { id: 'M1', titre: 'Premier module' },
  { id: 'M2', titre: 'Second module' },
]
const BLOCS: BlocImporte[] = [
  { code: MANIFESTE.bloc, moduleCode: 'M1', partie: '1.1 Partie', manifeste: MANIFESTE },
]
const f = fabrique()
const faits = jusquaProvisoire(f)
const aujourdhui = { jour: '2026-06-01', taches: [] }

const retenir = (preuves: ReturnType<typeof cinqPreuvesDuBloc>) => preuves.retenir?.prochaine

const entreeTableau = {
  modules: MODULES,
  module: undefined,
  periode: undefined,
  blocs: BLOCS,
  faits,
  reglages: REGLAGES,
  maintenant: MAINTENANT,
  controles: [],
  revuesCartes: [],
  mesuresTemps: [],
  derniereRevue: null,
  couts: [],
  aujourdhui,
}

describe('le statut et les preuves d’un bloc rendus par l’API', () => {
  it('rend le statut calculé, sans rien manquer quand tout est fait', () => {
    const resultat = calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT)
    expect(statutDuBloc(resultat)).toMatchObject({ statut: resultat.statut })
  })

  it('rend l’avancement du bloc : les étapes vues et la date de chaque étape prouvée', () => {
    const sansFait = statutDuBloc(calculerBloc([], MANIFESTE, REGLAGES, MAINTENANT))
    expect(sansFait.avancement).toEqual({
      etapes_vues: [],
      restitution: null,
      consolidation: null,
      pratique: null,
      atelier: null,
      aisance: null,
    })

    const faits = [
      f.etape(DEBUT, 'ET1'),
      f.etape(apres(DEBUT, 0, 1), 'ET3'),
      ...jusquaProvisoire(f),
    ]
    const resultat = calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT)
    const statut = statutDuBloc(resultat)
    expect(statut.avancement.etapes_vues).toEqual(['ET1', 'ET3'])
    expect(statut.avancement.restitution).toBe(resultat.dates.vu)
    expect(statut.avancement.consolidation).toBe(resultat.preuves.consolidation)
    expect(statut.avancement.pratique).toBe(resultat.preuves.pratique)
    expect(statut.avancement.atelier).toBe(resultat.preuves.atelier)
    expect(statut.avancement.aisance).toBe(resultat.preuves.aisance)
    expect(statut.avancement.restitution).not.toBeNull()
    expect(statut.avancement.consolidation).not.toBeNull()
  })

  it('rend ce qui manque à un bloc sans fait', () => {
    const resultat = calculerBloc([], MANIFESTE, REGLAGES, MAINTENANT)
    const statut = statutDuBloc(resultat)
    expect(statut.manque.length).toBe(resultat.manque.length)
    expect(statut.manque.length).toBeGreaterThan(0)
    for (const [i, manque] of statut.manque.entries()) {
      expect(manque.code).toBe(resultat.manque[i]?.code)
    }
  })

  it('rend chaque champ de ce qui manque, et seulement ceux qui existent', () => {
    const base = calculerBloc([], MANIFESTE, REGLAGES, MAINTENANT)
    const resultat: ResultatBloc = {
      ...base,
      manque: [
        { code: 'restitution_incomplete', questions: ['Q1'], exercices: ['E1'], erreurs: ['X1'] },
        { code: 'consolidation_insuffisante', apres: '2026-06-02', points: 0.5, requis: 0.8 },
        { code: 'erreur_ouverte' },
      ],
    }
    expect(statutDuBloc(resultat).manque).toEqual([
      { code: 'restitution_incomplete', questions: ['Q1'], exercices: ['E1'], erreurs: ['X1'] },
      { code: 'consolidation_insuffisante', apres: '2026-06-02', points: 0.5, requis: 0.8 },
      { code: 'erreur_ouverte' },
    ])
  })

  it('rend les cinq preuves, avec la prochaine échéance de rétention quand il y en a une', () => {
    const verifie = [...faits, f.verification(apres(DEBUT, 4))]
    const retenu = cinqPreuvesDuBloc(
      calculerBloc(verifie, MANIFESTE, REGLAGES, MAINTENANT),
      REGLAGES,
    )
    expect(retenir(retenu)).toEqual({ type: 'retest', apres: '2026-07-05' })
    const revu = cinqPreuvesDuBloc(
      calculerBloc(
        [...verifie, f.verification(apres(DEBUT, 40), { verification: 'retest' })],
        MANIFESTE,
        REGLAGES,
        apres(DEBUT, 41),
      ),
      REGLAGES,
    )
    expect(revu.retenir).not.toBeNull()
  })

  it('rend les cinq preuves, sans date de rétention avant la première', () => {
    const vide = cinqPreuvesDuBloc(calculerBloc([], MANIFESTE, REGLAGES, MAINTENANT), REGLAGES)
    expect(vide.retenir).toBeNull()
    const fait = cinqPreuvesDuBloc(calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT), REGLAGES)
    expect(fait.comprendre).not.toBeNull()
  })
})

describe('le tableau de bord', () => {
  it('prend le premier module et la période par défaut', () => {
    const tableau = composerTableau(entreeTableau)
    expect(tableau.module).toEqual(MODULES[0])
    expect(tableau.periode).toBe(PERIODE_PAR_DEFAUT)
    expect(tableau.blocs.map(({ bloc }) => bloc)).toEqual([MANIFESTE.bloc])
    expect(tableau.modules).toEqual(MODULES)
  })

  it('ne rend aucun bloc pour un module sans bloc, ni pour un module inconnu', () => {
    const second = composerTableau({ ...entreeTableau, module: 'M2', periode: '7j' })
    expect(second.module).toEqual(MODULES[1])
    expect(second.periode).toBe('7j')
    expect(second.blocs).toEqual([])
    const inconnu = composerTableau({ ...entreeTableau, module: 'M9' })
    expect(inconnu.module).toBeNull()
  })

  it('rend « non commencé » pour un bloc du module qui n’a aucun fait', () => {
    const tableau = composerTableau({ ...entreeTableau, faits: [] })
    expect(tableau.blocs.map(({ statut }) => statut)).toEqual(['non_commence'])
  })

  it('ne rend aucun module quand il n’y en a pas', () => {
    expect(composerTableau({ ...entreeTableau, modules: [], blocs: [] }).module).toBeNull()
  })

  it('compte les tâches restantes et plafonne la dépense', () => {
    const tache = {
      id: 't',
      genre: 'carte',
      titre: 'Une tâche',
      faite: false,
    } as never
    const tableau = composerTableau({
      ...entreeTableau,
      aujourdhui: {
        jour: aujourdhui.jour,
        taches: [tache, { ...(tache as object), faite: true } as never],
      },
      couts: [{ date: MAINTENANT, millioniemes: REGLAGES.plafondIaMillioniemes * 2 }],
    })
    expect(tableau.a_faire.aujourdhui).toBe(1)
    expect(tableau.cout_ia.depense_millioniemes).toBe(REGLAGES.plafondIaMillioniemes)
  })

  it('rend les mesures, y compris la cible d’aisance et le titre court des blocs', () => {
    const tableau = composerTableau({
      ...entreeTableau,
      mesuresTemps: [{ date: MAINTENANT, bloc: MANIFESTE.bloc, secondes: 60, etape: 'pratique' }],
    })
    expect(tableau.mesures.temps.blocs[0]?.titre_court).toBe(MANIFESTE.titre_court)
    expect(tableau.mesures.aisance.length).toBe(1)
  })

  it('rend les erreurs récurrentes, les erreurs sûres, les notions à reprendre et les étapes sautées', () => {
    const second = fabrique('D02')
    const troisieme = fabrique('D03')
    const manifeste2 = { ...MANIFESTE, aisance: undefined, bloc: 'D02', titre_court: 'Second bloc' }
    const lesFaits = [
      ...faits,
      {
        id: 'e1',
        bloc: MANIFESTE.bloc,
        date: MAINTENANT,
        type: 'erreur_cochee' as const,
        erreur: 'E1',
        source: 'amine' as const,
      },
      f.correction(apres(DEBUT, 6), 'restitution', 'R1', { niveau: 'fragile' }),
      f.correction(apres(DEBUT, 7), 'restitution', 'R1', { niveau: 'fragile' }),
      ...second.restitution(apres(DEBUT, 8)),
      ...troisieme.restitution(apres(DEBUT, 8, 30)),
      ...f.restitution(apres(DEBUT, 9)),
      f.etape(apres(DEBUT, 9, 40), 'ET1'),
      second.etape(apres(DEBUT, 9, 41), 'ET1'),
    ]
    const tableau = composerTableau({
      ...entreeTableau,
      blocs: [
        ...BLOCS,
        { code: 'D02', moduleCode: 'M1', partie: '1.1 Partie', manifeste: manifeste2 },
        {
          code: 'D03',
          moduleCode: 'M1',
          partie: '1.1 Partie',
          manifeste: { ...MANIFESTE, bloc: 'D03' },
        },
      ],
      faits: lesFaits,
      maintenant: apres(DEBUT, 10),
      periode: 'tout',
    })
    expect(tableau.erreurs.length).toBeGreaterThan(0)
    expect(tableau.mesures.revue.a_reprendre.length).toBeGreaterThan(0)
    expect(tableau.mesures.revue.etapes_sautees.length).toBeGreaterThan(0)
  })

  it('rend les erreurs sûres de la semaine', () => {
    const maintenant = apres(DEBUT, 2)
    const tableau = composerTableau({
      ...entreeTableau,
      faits: [
        ...faits,
        {
          id: 'c1',
          bloc: MANIFESTE.bloc,
          date: apres(DEBUT, 1),
          type: 'correction' as const,
          serie: 'restitution' as const,
          question: 'R9',
          tour: 1,
          niveau: 'fragile' as const,
          compte: true,
          confiance: 'sur' as const,
          erreursIa: [],
        },
      ],
      maintenant,
    })
    expect(tableau.mesures.calibration.erreurs_sures.length).toBe(1)
  })

  it('garde le code d’un bloc inconnu comme titre court', () => {
    const tableau = composerTableau({
      ...entreeTableau,
      mesuresTemps: [{ date: MAINTENANT, bloc: 'B-INCONNU', secondes: 60, etape: 'pratique' }],
    })
    expect(tableau.mesures.temps.blocs.find(({ bloc }) => bloc === 'B-INCONNU')?.titre_court).toBe(
      'B-INCONNU',
    )
  })
})

describe('le journal', () => {
  const entree = {
    modules: MODULES,
    blocs: BLOCS,
    faits,
    reglages: REGLAGES,
    maintenant: MAINTENANT,
    requete: {},
    notes: [],
    idees: [
      { id: 'i1', date: MAINTENANT, texte: 'Première' },
      { id: 'i2', date: MAINTENANT, texte: 'Seconde' },
    ],
  }

  it('rend les lignes, les blocs du premier module et les idées les plus récentes d’abord', () => {
    const journal = composerJournal(entree)
    expect(journal.entrees.length).toBeGreaterThan(0)
    expect(journal.blocs.map(({ bloc }) => bloc)).toEqual([MANIFESTE.bloc])
    expect(journal.idees.map(({ id }) => id)).toEqual(['i2', 'i1'])
    expect(journal.entrees.every(({ note }) => note === null)).toBe(true)
  })

  it('joint la note d’une ligne et filtre par module, bloc et type', () => {
    const ligne = composerJournal(entree).entrees[0]
    expect(ligne).toBeDefined()
    const note = { id: 'n1', entree: ligne?.id ?? '', date: MAINTENANT, texte: 'Une note' }
    const avecNote = composerJournal({ ...entree, notes: [note] })
    expect(avecNote.entrees.find(({ id }) => id === note.entree)?.note).toEqual(note)

    expect(composerJournal({ ...entree, requete: { module: 'M2' } }).entrees).toEqual([])
    expect(composerJournal({ ...entree, requete: { module: 'M2' } }).blocs).toEqual([])
    const filtre = composerJournal({
      ...entree,
      requete: {
        module: 'M1',
        bloc: MANIFESTE.bloc,
        type: ligne?.type ?? 'restitution',
        avant: '2100-01-01T00:00:00Z',
      },
    })
    expect(filtre.entrees.length).toBeGreaterThan(0)
  })

  it('rend une contestation en attente avec la ligne de sa correction', () => {
    const correction = f.correction(apres(DEBUT, 0, 3), 'restitution', 'R1')
    const contestation = f.fait(apres(DEBUT, 0, 4), {
      type: 'correction_contestee',
      correction: correction.id,
    })
    const journal = composerJournal({ ...entree, faits: [correction, contestation] })
    expect(journal.entrees.some((ligne) => ligne.contestation_en_attente === true)).toBe(true)
  })

  it('rend « non commencé » pour un bloc du module qui n’a aucun fait', () => {
    expect(composerJournal({ ...entree, faits: [] }).blocs.map(({ statut }) => statut)).toEqual([
      'non_commence',
    ])
  })

  it('ne rend pas de bloc dont le manifeste manque', () => {
    expect(composerJournal({ ...entree, modules: [] }).blocs).toEqual([])
  })

  it('exporte le journal en texte', () => {
    const texte = composerExport({
      blocs: BLOCS,
      faits,
      reglages: REGLAGES,
      tachesReservees: [],
      idees: [{ texte: 'Une idée' }],
      derniereRevue: null,
    })
    expect(texte).toContain('Une idée')
  })

  it('retrouve la ligne d’un identifiant, avec le code de son bloc', () => {
    const ligne = composerJournal(entree).entrees[0]
    const trouvee = ligneDuJournal(ligne?.id ?? '', { blocs: BLOCS, faits, reglages: REGLAGES })
    expect(trouvee?.bloc).toBe(MANIFESTE.bloc)
    expect(ligneDuJournal('absente', { blocs: BLOCS, faits, reglages: REGLAGES })).toBeUndefined()
  })
})

describe('aisanceReussies', () => {
  it('garde les séries réussies, de la plus ancienne à la plus récente', () => {
    const g = fabrique()
    const tard = g.aisance(apres(DEBUT, 2), 18.2)
    const ratee = g.aisance(apres(DEBUT, 1, 1), 40, false)
    const tot = g.aisance(apres(DEBUT, 1), 27.5)
    expect(aisanceReussies([tard, ratee, tot, g.etape(DEBUT, 'ET1')])).toEqual([
      { le: tot.date, duree_s: 27.5 },
      { le: tard.date, duree_s: 18.2 },
    ])
  })
})
