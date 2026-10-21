import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Fait as SchemaFait, Reglages as SchemaReglages } from '@janus/contrats'
import type { Niveau, Reglages } from '@janus/contrats'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait, ReponseVerification } from './faits.ts'
import { calculerBloc } from './statut.ts'
import { SuiviBloc } from './suiviBloc.ts'

const MAINTENANT = apres(DEBUT, 400)

/** L'élément de la liste à ce rang, ou une erreur : un test ne tire pas hors des bornes. */
function au<T>(liste: readonly T[], rang: number): T {
  const element = liste[rang]
  if (element === undefined) throw new Error(`Pas d'élément au rang ${String(rang)}`)
  return element
}

/** Après chaque fait, le suivi dit ce que dit `calculerBloc` sur les faits reçus jusque-là. */
function verifierChaquePrefixe(
  faits: readonly Fait[],
  reglages: Reglages = REGLAGES,
  maintenants: (fait: Fait) => readonly string[] = (fait) => [fait.date, MAINTENANT],
): void {
  const suivi = new SuiviBloc(MANIFESTE, reglages)
  expect(suivi.resultat(MAINTENANT)).toEqual(calculerBloc([], MANIFESTE, reglages, MAINTENANT))
  faits.forEach((fait, rang) => {
    suivi.ajouter(fait)
    const recus = faits.slice(0, rang + 1)
    for (const maintenant of maintenants(fait)) {
      const attendu = calculerBloc(recus, MANIFESTE, reglages, maintenant)
      expect(suivi.resultat(maintenant), `après ${String(rang + 1)} faits à ${maintenant}`).toEqual(
        attendu,
      )
      expect(suivi.statutCalcule()).toBe(attendu.statutCalcule)
    }
  })
}

describe('SuiviBloc : le statut après chaque fait est celui de calculerBloc sur les faits reçus', () => {
  it('une chronologie complète, jusqu’à « maîtrisé »', () => {
    const f = fabrique()
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(apres(DEBUT, 0, 5)),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...f.consolidation(apres(DEBUT, 0, 120)),
      f.cochee(apres(DEBUT, 1), 'E1'),
      f.decochee(apres(DEBUT, 2), 'E1'),
      f.verification(apres(DEBUT, 5)),
      f.verification(apres(DEBUT, 40), { verification: 'retest' }),
      f.aisance(apres(DEBUT, 41), 20),
      f.aisance(apres(DEBUT, 42), 22),
      f.force(apres(DEBUT, 43), 'vu', 'Pour voir'),
      f.levee(apres(DEBUT, 44)),
    ]
    verifierChaquePrefixe(faits)
    expect(calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT).statutCalcule).toBe('maitrise')
  })

  it('un bloc sans fait est « non commencé », comme calculerBloc', () => {
    expect(new SuiviBloc(MANIFESTE, REGLAGES).statutCalcule()).toBe('non_commence')
  })

  it('un fait d’un autre bloc ne compte pas', () => {
    const f = fabrique('B99')
    const suivi = new SuiviBloc(MANIFESTE, REGLAGES)
    suivi.ajouter(f.etape(DEBUT, 'ET1'))
    expect(suivi.statutCalcule()).toBe('non_commence')
    expect(suivi.resultat(MAINTENANT)).toEqual(calculerBloc([], MANIFESTE, REGLAGES, MAINTENANT))
  })

  it('le résultat rendu ne bouge plus quand d’autres faits arrivent', () => {
    const f = fabrique()
    const suivi = new SuiviBloc(MANIFESTE, REGLAGES)
    suivi.ajouter(f.cochee(apres(DEBUT, 0, 1), 'E1'))
    const avant = suivi.resultat(MAINTENANT)
    const copie = structuredClone(avant)
    suivi.ajouter(f.cochee(apres(DEBUT, 0, 2), 'E2'))
    suivi.ajouter(f.decochee(apres(DEBUT, 0, 3), 'E1'))
    expect(avant).toEqual(copie)
    expect(suivi.resultat(MAINTENANT).erreursOuvertes).toEqual(['E2'])
  })

  describe('les faits qui ne s’ajoutent pas en bout de liste', () => {
    it('même date, identifiants à l’envers : le plus petit identifiant passe devant', () => {
      const f = fabrique()
      const faits = [
        ...f.pratique(DEBUT),
        f.atelier(apres(DEBUT, 0, 5)),
        ...f.restitution(apres(DEBUT, 0, 30)).toReversed(),
        ...f.consolidation(apres(DEBUT, 0, 120)).toReversed(),
      ]
      verifierChaquePrefixe(faits)
    })

    it('un homonyme plus tardif est ignoré, un homonyme plus tôt prend la place', () => {
      const f = fabrique()
      const restitution = f.restitution(apres(DEBUT, 0, 30))
      const r1 = au(restitution, 0)
      const tard = { ...r1, date: apres(DEBUT, 0, 90) }
      const tot = { ...au(restitution, 1), date: apres(DEBUT, 0, 10), id: r1.id }
      const memeDate = { ...au(restitution, 2), id: r1.id }
      verifierChaquePrefixe([...restitution, tard, tot, memeDate])
    })

    it('des faits dans le désordre complet', () => {
      const f = fabrique()
      const faits = [
        f.verification(apres(DEBUT, 5)),
        f.aisance(apres(DEBUT, 41), 20),
        ...f.consolidation(apres(DEBUT, 0, 120)),
        f.verification(apres(DEBUT, 40), { verification: 'retest' }),
        ...f.restitution(apres(DEBUT, 0, 30)),
        f.aisance(apres(DEBUT, 42), 22),
        ...f.pratique(DEBUT),
        f.atelier(apres(DEBUT, 0, 5)),
      ]
      verifierChaquePrefixe(faits)
    })
  })

  describe('les tranchages', () => {
    const jusquaConsolidation = (f: ReturnType<typeof fabrique>) => [
      ...f.pratique(DEBUT),
      f.atelier(apres(DEBUT, 0, 5)),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...f.consolidation(apres(DEBUT, 0, 120)),
    ]
    const tranche = (
      f: ReturnType<typeof fabrique>,
      minutes: number,
      correction: Fait | undefined,
      compte: boolean,
      niveau?: Niveau,
    ) =>
      f.fait(apres(DEBUT, 0, minutes), {
        type: 'correction_tranchee',
        correction: correction?.id ?? 'absente',
        compte,
        ...(niveau === undefined ? {} : { niveau }),
      })

    it('qui change une réponse de consolidation déjà là : les séries sont refaites', () => {
      const f = fabrique()
      const faits = jusquaConsolidation(f)
      const consolidation = faits.filter(
        (fait) => fait.type === 'correction' && fait.serie === 'consolidation',
      )
      verifierChaquePrefixe([
        ...faits,
        tranche(f, 200, consolidation[1], false),
        tranche(f, 201, consolidation[1], true, 'fragile'),
        tranche(f, 202, consolidation[1], true, 'solide'),
      ])
    })

    it('qui change si une réponse de restitution ferme des erreurs : erreurs et vérifications sont refaites', () => {
      const f = fabrique()
      const faits = jusquaConsolidation(f)
      const restitution = faits.filter(
        (fait) => fait.type === 'correction' && fait.serie === 'restitution',
      )
      // E3 est cochée (deux fois de suite) avant la réponse à R4, qui la ferme ; le tranchage la rouvre, puis la referme.
      const faitsDEntree = [
        f.cochee(apres(DEBUT, 0, 10), 'E3'),
        f.cochee(apres(DEBUT, 0, 11), 'E3'),
        ...faits,
      ]
      const avecTranchages = [
        ...faitsDEntree,
        f.verification(apres(DEBUT, 5)),
        tranche(f, 7 * 24 * 60, restitution[3], false),
        tranche(f, 7 * 24 * 60 + 1, restitution[3], true),
      ]
      verifierChaquePrefixe(avecTranchages)
      const rouverte = calculerBloc(avecTranchages.slice(0, -1), MANIFESTE, REGLAGES, MAINTENANT)
      expect(rouverte.erreursOuvertes).toEqual(['E3'])
    })

    it('une série de consolidation valable suffit : les séries suivantes n’y changent rien', () => {
      const f = fabrique()
      const faits = [
        ...jusquaConsolidation(f),
        ...f.consolidation(apres(DEBUT, 1), ['pas_encore', 'pas_encore', 'pas_encore']),
        ...f.consolidation(apres(DEBUT, 2), ['pas_encore', 'pas_encore', 'pas_encore']),
      ]
      verifierChaquePrefixe(faits)
      expect(calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT).statutCalcule).toBe(
        'acquis_provisoirement',
      )
    })

    it('qui ne change rien à ce que les règles lisent', () => {
      const f = fabrique()
      const faits = jusquaConsolidation(f)
      const restitution = faits.filter(
        (fait) => fait.type === 'correction' && fait.serie === 'restitution',
      )
      const rappel = f.correction(apres(DEBUT, 0, 140), 'rappel', 'RA1', { niveau: 'solide' })
      const deuxiemeTour = f.correction(apres(DEBUT, 0, 141), 'restitution', 'R1', { tour: 2 })
      const fragile = f.correction(apres(DEBUT, 0, 142), 'restitution', 'R1', { niveau: 'fragile' })
      verifierChaquePrefixe([
        ...faits,
        rappel,
        deuxiemeTour,
        fragile,
        tranche(f, 200, rappel, false),
        tranche(f, 201, deuxiemeTour, false),
        // Même compte et même niveau que la réponse d'origine.
        tranche(f, 202, restitution[1], true, 'solide'),
        // Elle ne fermait déjà rien, et ne ferme toujours rien.
        tranche(f, 203, fragile, false),
      ])
    })

    it('qui rend une erreur à son ouverture d’origine : elle reprend sa place dans l’ordre des erreurs ouvertes', () => {
      const f = fabrique()
      const reponse = f.correction(apres(DEBUT, 0, 50), 'restitution', 'R2', { niveau: 'solide' })
      const avantTranchage = [
        f.cochee(apres(DEBUT, 0, 35), 'E1'),
        f.cochee(apres(DEBUT, 0, 40), 'E2'),
        // Solide : elle ferme E2, qui est cochée de nouveau ensuite.
        reponse,
        f.cochee(apres(DEBUT, 0, 60), 'E2'),
      ]
      const faits = [...avantTranchage, tranche(f, 70, reponse, true, 'fragile')]
      verifierChaquePrefixe(faits)
      const ordre = (recus: readonly Fait[]) =>
        calculerBloc(recus, MANIFESTE, REGLAGES, MAINTENANT).erreursOuvertes
      // E2 a été cochée en deuxième, puis refermée et recochée ; sans cette réponse, elle ne s'est jamais fermée.
      expect(ordre(avantTranchage)).toEqual(['E1', 'E2'])
      expect(ordre(faits)).toEqual(['E1', 'E2'])
    })

    it('qui arrive avant sa correction, ou pour une correction qui n’existe pas', () => {
      const f = fabrique()
      const faits = jusquaConsolidation(f)
      const consolidation = faits.filter(
        (fait) => fait.type === 'correction' && fait.serie === 'consolidation',
      )
      const enAvance = [
        tranche(f, 0, consolidation[0], false, 'pas_encore'),
        tranche(f, 1, undefined, true),
        ...faits,
      ]
      verifierChaquePrefixe(enAvance)
    })
  })

  describe('la date d’« acquis provisoirement » arrive après des vérifications', () => {
    it('une vérification faite le jour même du dernier fait qui remplit les conditions', () => {
      const reglages = SchemaReglages.parse({ delaiVerificationJours: 1 })
      const f = fabrique()
      const verification = f.verification(apres(DEBUT, 0, 100))
      verifierChaquePrefixe(
        [
          verification,
          ...f.pratique(DEBUT),
          f.atelier(apres(DEBUT, 0, 5)),
          ...f.restitution(apres(DEBUT, 0, 30)),
          ...f.consolidation(apres(DEBUT, 0, 120)),
          f.verification(apres(DEBUT, 1, 200)),
        ],
        reglages,
      )
    })
  })
})

// --- Propriété : sur des jeux tordus, tous les préfixes -----------------------------------------------------

const NIVEAUX: readonly Niveau[] = [
  'solide',
  'solide',
  'solide',
  'partiel',
  'fragile',
  'pas_encore',
]
const ECARTS_JOURS = [0, 0, 0, 0, 1, 2, 3, 3, 4, 7, 20, 31, 33, 35, 36, 60, 100]
const ECARTS_MINUTES = [0, 0, 1, 2, 5, 29, 30, 59, 60, 61, 119, 120, 121, 125, 600]
const IDENTIFIANTS_PARCOURS = Array.from({ length: 16 }, (_, i) => `p${String(i + 1)}`)
const QUESTIONS = [...MANIFESTE.restitution, ...MANIFESTE.consolidation, ...MANIFESTE.rappel].map(
  (question) => question.id,
)

const reponses = (reussi: boolean, compte: boolean): ReponseVerification[] => [
  { type: 'explication', question: 'DE1', tour: 1, niveau: reussi ? 'solide' : 'fragile', compte },
  { type: 'tache', question: 'DT1', tour: 1, reussi, compte },
  { type: 'transfert', question: 'DR1', tour: 1, niveau: reussi ? 'solide' : 'partiel', compte },
]

/** Les champs propres à un fait, sans son identifiant, son bloc ni sa date. */
type Donnees = Record<string, unknown>

interface Bruit {
  readonly jours: number
  readonly minutes: number
  readonly identifiant: string | undefined
  readonly donnees: Donnees
  readonly autreBloc: boolean
}

const donneesDeBruit: fc.Arbitrary<Donnees> = fc.oneof(
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('bloc_ouvert' as const),
      horsPrerequis: fc.boolean(),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant('etape_vue' as const),
      etape: fc.constantFrom('ET1', 'ET3', 'ET7', 'ET8', 'ET9', 'inconnue'),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant('pratique_resultat' as const),
      exercice: fc.constantFrom('PR1', 'PR1', 'PR2'),
      item: fc.constantFrom('PR1-1', 'PR1-2', 'PR1-3', 'PR1-9'),
      reussi: fc.boolean(),
      aide: fc.constantFrom(0, 0, 0, 1, 4),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('atelier_resultat' as const),
      reussi: fc.boolean(),
      aide: fc.constantFrom(0, 0, 2),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant('aisance_resultat' as const),
      reussi: fc.boolean(),
      dureeS: fc.integer({ min: 10, max: 45 }),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      type: fc.constant('correction' as const),
      serie: fc.constantFrom(
        'restitution',
        'consolidation',
        'consolidation',
        'rappel',
        'verification',
      ),
      question: fc.constantFrom(...QUESTIONS, 'inconnue'),
      tour: fc.constantFrom(1, 1, 1, 2),
      niveau: fc.constantFrom(...NIVEAUX),
      compte: fc.boolean(),
      confiance: fc.constantFrom('sur' as const, 'hesitant' as const),
      erreursIa: fc.constant<string[]>([]),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant('correction_tranchee' as const),
      correction: fc.constantFrom(...IDENTIFIANTS_PARCOURS, 'absente'),
      compte: fc.boolean(),
      niveau: fc.constantFrom(...NIVEAUX),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('correction_contestee' as const),
      correction: fc.constantFrom(...IDENTIFIANTS_PARCOURS),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant('erreur_ia_tranchee' as const),
      correction: fc.constantFrom(...IDENTIFIANTS_PARCOURS),
      erreur: fc.constantFrom('E1', 'E2'),
      decision: fc.constantFrom('confirmee' as const, 'rejetee' as const),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant('verification_terminee' as const),
      verification: fc.constantFrom(
        'verification' as const,
        'retest' as const,
        'entretien' as const,
      ),
      valable: fc.constantFrom(true, true, true, false),
      reponses: fc
        .boolean()
        .chain((reussi) => fc.boolean().map((compte) => reponses(reussi, compte))),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constantFrom('erreur_cochee' as const, 'erreur_decochee' as const),
      erreur: fc.constantFrom('E1', 'E2', 'E3'),
      source: fc.constantFrom('amine' as const, 'ia_confirmee' as const),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('statut_force' as const),
      statut: fc.constantFrom('vu' as const, 'acquis' as const, 'maitrise' as const),
      raison: fc.constant('Raison'),
    }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('force_levee' as const) }) },
)

const bruit: fc.Arbitrary<Bruit> = fc.record({
  jours: fc.constantFrom(...ECARTS_JOURS),
  minutes: fc.constantFrom(...ECARTS_MINUTES),
  // Un identifiant sur trois reprend celui d'un fait du parcours, ou d'un autre bruit.
  identifiant: fc.option(fc.constantFrom(...IDENTIFIANTS_PARCOURS, 'b1', 'b2'), { freq: 3 }),
  donnees: donneesDeBruit,
  autreBloc: fc.constantFrom(false, false, false, false, false, false, false, false, false, true),
})

const reglagesAleatoires: fc.Arbitrary<Reglages> = fc
  .record({
    fuseau: fc.constantFrom('Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'UTC'),
    heureBascule: fc.integer({ min: 0, max: 6 }),
    delaiConsolidationMinutes: fc.constantFrom(30, 60, 120, 600),
    delaiVerificationJours: fc.integer({ min: 1, max: 5 }),
    delaiRetestJours: fc.constantFrom(14, 20, 30),
    delaiNouvelEssaiJours: fc.integer({ min: 1, max: 3 }),
    echecsAvantDescente: fc.integer({ min: 1, max: 3 }),
    seuilConsolidation: fc.constantFrom(0.5, 0.8, 1),
  })
  .map((reglages) => SchemaReglages.parse(reglages))

/** Une chronologie qui peut aller jusqu'à « maîtrisé », coupée au hasard : les statuts intermédiaires y passent. */
function parcours(parametres: {
  readonly jVerification: number
  readonly jRetest: number
  readonly echecVerification: boolean
  readonly echecsRetest: number
  readonly consolidationFaible: boolean
  readonly coupe: number
}): Fait[] {
  const { jVerification, jRetest, echecVerification, echecsRetest, consolidationFaible, coupe } =
    parametres
  const faits: Fait[] = []
  const ajoute = (jours: number, minutes: number, donnees: Donnees) => {
    faits.push(
      SchemaFait.parse({
        id: `p${String(faits.length + 1)}`,
        bloc: MANIFESTE.bloc,
        date: apres(DEBUT, jours, minutes),
        ...donnees,
      }),
    )
  }
  for (const [i, q] of MANIFESTE.restitution.entries()) {
    ajoute(0, 30 + i, correctionSolide('restitution', q.id))
  }
  for (const [i, q] of MANIFESTE.consolidation.entries()) {
    ajoute(0, 130 + i, {
      ...correctionSolide('consolidation', q.id),
      ...(consolidationFaible ? { niveau: 'fragile' } : {}),
    })
  }
  for (let i = 1; i <= 2; i += 1) {
    ajoute(0, i, {
      type: 'pratique_resultat',
      exercice: 'PR1',
      item: `PR1-${String(i)}`,
      reussi: true,
      aide: 0,
    })
  }
  ajoute(0, 5, { type: 'atelier_resultat', reussi: true, aide: 0 })
  ajoute(jVerification, 200, {
    type: 'verification_terminee',
    verification: 'verification',
    valable: true,
    reponses: reponses(!echecVerification, true),
  })
  ajoute(jVerification, 300, {
    type: 'verification_terminee',
    verification: 'verification',
    valable: true,
    reponses: reponses(true, true),
  })
  // Des retests ratés, qui font redescendre quand ils s'enchaînent.
  for (let i = 0; i < echecsRetest; i += 1) {
    ajoute(jVerification + jRetest, 100 + i, {
      type: 'verification_terminee',
      verification: 'retest',
      valable: true,
      reponses: reponses(false, true),
    })
  }
  ajoute(jVerification + jRetest, 200, {
    type: 'verification_terminee',
    verification: 'retest',
    valable: true,
    reponses: reponses(true, true),
  })
  ajoute(jVerification + jRetest + 1, 0, { type: 'aisance_resultat', reussi: true, dureeS: 20 })
  ajoute(jVerification + jRetest + 2, 0, { type: 'aisance_resultat', reussi: true, dureeS: 22 })
  return faits.slice(0, coupe)
}

function correctionSolide(serie: 'restitution' | 'consolidation', question: string) {
  return {
    type: 'correction' as const,
    serie,
    question,
    tour: 1,
    niveau: 'solide' as const,
    compte: true,
    confiance: 'sur' as const,
    erreursIa: [],
  }
}

/** Mélange déterministe : les éléments rangés par une clé tirée de leur rang et de la graine. */
function melanger<T>(liste: readonly T[], graine: number): T[] {
  const cle = (rang: number) => Math.imul((rang + 1) ^ graine, 2_654_435_761) >>> 0
  return liste
    .map((element, rang) => ({ element, cle: cle(rang) }))
    .sort((a, b) => a.cle - b.cle)
    .map(({ element }) => element)
}

const scenario = fc
  .record({
    jVerification: fc.integer({ min: 0, max: 8 }),
    jRetest: fc.integer({ min: 10, max: 60 }),
    echecVerification: fc.boolean(),
    echecsRetest: fc.integer({ min: 0, max: 3 }),
    consolidationFaible: fc.constantFrom(false, false, true),
    coupe: fc.integer({ min: 0, max: 22 }),
    bruit: fc.array(bruit, { maxLength: 22 }),
    ordre: fc.constantFrom(
      'chronologique',
      'chronologique',
      'chronologique',
      'melange',
      'echanges',
    ),
    graine: fc.integer({ min: 0, max: 0xffffff }),
    reglages: reglagesAleatoires,
  })
  .map((jeu) => {
    const dePasse = jeu.bruit.map((b, rang) =>
      SchemaFait.parse({
        id: b.identifiant ?? `b${String(rang + 3)}`,
        bloc: b.autreBloc ? 'B99' : MANIFESTE.bloc,
        date: apres(DEBUT, b.jours, b.minutes),
        ...b.donnees,
      }),
    )
    const tous = [...parcours(jeu), ...dePasse]
    // L'ordre d'arrivée : par date (comme le journal, à égalité l'ordre de création), ou plus tordu.
    const parDate = tous.toSorted((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const arrivee =
      jeu.ordre === 'melange'
        ? melanger(tous, jeu.graine)
        : jeu.ordre === 'echanges'
          ? melanger(parDate.slice(0, 6), jeu.graine).concat(parDate.slice(6))
          : parDate
    return { faits: arrivee, reglages: jeu.reglages }
  })

describe('SuiviBloc : propriété, sur des jeux tordus (égalités de date, identifiants en double, désordre, tranchages, forçages)', () => {
  // 400 tirages, et chaque préfixe recalculé en entier : une seconde ici, mais un exécuteur de CI
  // chargé a dépassé les 5 s par défaut (main, 14 octobre 2026). Le délai dit ce que le test coûte.
  it('chaque préfixe donne le résultat complet de calculerBloc', () => {
    const rencontres = new Set<string>()
    fc.assert(
      fc.property(scenario, ({ faits, reglages }) => {
        const suivi = new SuiviBloc(MANIFESTE, reglages)
        faits.forEach((fait, rang) => {
          suivi.ajouter(fait)
          const recus = faits.slice(0, rang + 1)
          for (const maintenant of [fait.date, MAINTENANT]) {
            const attendu = calculerBloc(recus, MANIFESTE, reglages, maintenant)
            expect(suivi.resultat(maintenant)).toEqual(attendu)
            expect(suivi.statutCalcule()).toBe(attendu.statutCalcule)
            rencontres.add(attendu.statutCalcule)
            for (const { code } of attendu.manque) rencontres.add(code)
            if (attendu.descendu) rencontres.add('descendu')
            if (attendu.force !== null) rencontres.add('force')
          }
        })
      }),
      { seed: 20_260_601, numRuns: 400 },
    )
    // Le générateur va bien jusqu'au bout du parcours, et par les descentes, les forçages et les manques.
    for (const attendu of [
      'non_commence',
      'en_cours',
      'vu',
      'acquis_provisoirement',
      'acquis',
      'maitrise',
      'a_reprendre',
      'descendu',
      'force',
      'consolidation_trop_tot',
      'consolidation_insuffisante',
      'verification_a_venir',
      'retest_a_faire',
      'aisance_non_atteinte',
    ]) {
      expect(rencontres, attendu).toContain(attendu)
    }
  }, 60_000)
})
