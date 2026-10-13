import { argv, exit, hrtime } from 'node:process'
import type { Fait } from '@janus/contrats'
import {
  apercuCarte,
  aisanceDesBlocs,
  autonomie,
  blocEnCours,
  calculerBloc,
  calibration,
  cartesDuJour,
  carteNeuve,
  choisirQuestionsDebut,
  composerExport,
  composerJournal,
  composerTableau,
  depenseDuMois,
  echeances,
  erreursRecurrentes,
  fileDuJour,
  fiabilite,
  jourDe,
  ligneDuJournal,
  lignesDuJournal,
  noterCarte,
  retention,
  revueMethode,
  seances,
  tirerDifferee,
} from '../src/index.ts'
import type { BlocDeLaFile, CarteDuBloc } from '../src/index.ts'
import { jeuDeFaits, MAINTENANT, REGLAGES } from './donnees.ts'

// Usage : node bench/lancer.ts <scénario> <nombre total de faits> [blocs] [budget ms]
// Sortie : une ligne JSON { scenario, n, blocs, ms (médiane), min, iterations }.

const [scenario = '', nTexte = '1000', blocsTexte = '50', budgetTexte = '1500'] = argv.slice(2)
const n = Number(nTexte)
const budgetMs = Number(budgetTexte)
const nBlocs = Math.max(1, Math.min(Number(blocsTexte), Math.floor(n / 30)))
const jeu = jeuDeFaits(nBlocs, Math.max(30, Math.round(n / nBlocs)))
const { faits, blocs, modules } = jeu
const premier = blocs[0]
if (premier === undefined) throw new Error('Jeu vide')
const manifestes = Object.fromEntries(blocs.map(({ code, manifeste }) => [code, manifeste]))

/** Calcule à la première demande seulement : un scénario ne paie que ce dont il se sert. */
function paresseux<T>(calcul: () => T): () => T {
  let valeur: { lue: T } | undefined
  return () => (valeur ??= { lue: calcul() }).lue
}

const duBloc = paresseux(() => {
  const table = new Map<string, Fait[]>()
  for (const fait of faits) {
    const liste = table.get(fait.bloc)
    if (liste === undefined) table.set(fait.bloc, [fait])
    else liste.push(fait)
  }
  return table
})
const blocsFile = paresseux((): BlocDeLaFile[] =>
  blocs.map(({ code, manifeste }) => {
    const siens = duBloc().get(code) ?? []
    return {
      manifeste,
      etat: calculerBloc(siens, manifeste, REGLAGES, MAINTENANT),
      dernierFait: siens.reduce<string | null>(
        (max, fait) => (max === null || fait.date > max ? fait.date : max),
        null,
      ),
    }
  }),
)
const nCartes = Math.max(10, Math.round(n / 10))
const cartes = paresseux((): CarteDuBloc[] => {
  const vue = noterCarte(carteNeuve(MAINTENANT), 'bien', MAINTENANT, REGLAGES)
  return Array.from({ length: nCartes }, (_, i) => ({
    id: `c${String(i).padStart(8, '0')}`,
    bloc: blocs[i % blocs.length]?.code ?? '',
    etat: i % 5 === 0 ? null : vue,
  }))
})
const mesuresTemps = paresseux(() =>
  faits
    .filter((_, i) => i % 5 === 0)
    .map((fait) => ({
      date: fait.date,
      bloc: fait.bloc,
      secondes: 60,
      etape: 'pratique' as const,
    })),
)
const revuesCartes = paresseux(() =>
  faits.filter((_, i) => i % 3 === 0).map((fait) => ({ date: fait.date, note: 'bien' as const })),
)
const couts = paresseux(() =>
  faits.filter((_, i) => i % 10 === 0).map((fait) => ({ date: fait.date, millioniemes: 100 })),
)
const controles = paresseux(() =>
  faits
    .filter((_, i) => i % 7 === 0)
    .map((fait) => ({ date: fait.date, echantillon: true, nonVerifiee: false, accord: true })),
)

const scenarios: Record<string, () => () => unknown> = {
  jourDe: () => () => jourDe('2026-03-01T12:34:56Z', REGLAGES.fuseau, REGLAGES.heureBascule),
  // 1000 dates différentes, comme une lecture qui parcourt des faits.
  jourDe_1000_dates: () => () => {
    let dernier = ''
    for (let i = 0; i < 1000; i += 1) {
      dernier = jourDe(faits[i % faits.length]?.date ?? '', REGLAGES.fuseau, REGLAGES.heureBascule)
    }
    return dernier
  },
  calculerBloc_un: () => {
    const siens = duBloc().get(premier.code) ?? []
    return () => calculerBloc(siens, premier.manifeste, REGLAGES, MAINTENANT)
  },
  // Ce que fait composerTableau pour chaque bloc : filtrer tous les faits puis calculer.
  calculerBloc_tous: () => () =>
    blocs.map(({ code, manifeste }) =>
      calculerBloc(
        faits.filter((fait) => fait.bloc === code),
        manifeste,
        REGLAGES,
        MAINTENANT,
      ),
    ),
  tableau: () => {
    const entree = {
      modules,
      module: undefined,
      periode: 'tout' as const,
      blocs,
      faits,
      reglages: REGLAGES,
      maintenant: MAINTENANT,
      controles: controles(),
      revuesCartes: revuesCartes(),
      mesuresTemps: mesuresTemps(),
      derniereRevue: null,
      couts: couts(),
      aujourdhui: { jour: '2026-12-01', taches: [] },
    }
    return () => composerTableau(entree)
  },
  journal: () => () =>
    composerJournal({
      modules,
      blocs,
      faits,
      reglages: REGLAGES,
      maintenant: MAINTENANT,
      requete: {},
      notes: [],
      idees: [],
    }),
  lignesDuJournal: () => () => lignesDuJournal(faits, { manifestes, reglages: REGLAGES }),
  ligneDuJournal: () => () => ligneDuJournal('absente', { blocs, faits, reglages: REGLAGES }),
  export: () => () =>
    composerExport({
      blocs,
      faits,
      reglages: REGLAGES,
      tachesReservees: [],
      idees: [],
      derniereRevue: null,
    }),
  revueMethode: () => {
    const manifs = blocs.map(({ manifeste }) => manifeste)
    return () => revueMethode(faits, mesuresTemps(), manifs, null, REGLAGES)
  },
  autonomie: () => () => autonomie(faits, MAINTENANT, REGLAGES),
  retention: () => () => retention(faits, revuesCartes(), MAINTENANT, REGLAGES),
  calibration_tout: () => () => calibration(faits, 'tout', MAINTENANT, REGLAGES),
  calibration_30j: () => () => calibration(faits, '30j', MAINTENANT, REGLAGES),
  erreursRecurrentes: () => () =>
    erreursRecurrentes(faits, new Map(), new Set(), 'tout', MAINTENANT, REGLAGES),
  fiabilite: () => () => fiabilite(controles(), faits, '30j', MAINTENANT, REGLAGES),
  depenseDuMois: () => () => depenseDuMois(couts(), MAINTENANT, REGLAGES),
  aisanceDesBlocs: () => {
    const manifs = blocs.map(({ manifeste }) => manifeste)
    return () => aisanceDesBlocs(manifs, faits, REGLAGES)
  },
  seances: () => () => seances(faits, REGLAGES),
  questionsDebut: () => {
    const vus = blocs
      .slice(0, 20)
      .map(({ manifeste }) => ({ manifeste, prerequisDuBlocEnCours: false }))
    return () => choisirQuestionsDebut(vus, faits, REGLAGES, 7)
  },
  fileDuJour: () => {
    const entree = {
      blocs: blocsFile(),
      questionsDebut: 6,
      cartes: {
        dues: cartes()
          .slice(0, 40)
          .map(({ id }) => id),
        nouvelles: [],
      },
      derniereActivite: MAINTENANT,
      maintenant: MAINTENANT,
      reglages: REGLAGES,
    }
    return () => fileDuJour(entree)
  },
  echeances_tous: () => {
    const fichier = blocsFile()
    return () => fichier.map(({ etat }) => echeances(etat, REGLAGES))
  },
  blocEnCours: () => {
    const fichier = blocsFile().map(({ manifeste, etat, dernierFait }) => ({
      bloc: manifeste.bloc,
      statut: etat.statut,
      dernierFait,
    }))
    return () => blocEnCours(fichier)
  },
  cartesDuJour: () => {
    const entree = {
      cartes: cartes(),
      blocsVus: blocs.map(({ code }) => code),
      nouvellesDejaIntroduites: 0,
      maintenant: MAINTENANT,
      reglages: REGLAGES,
    }
    return () => cartesDuJour(entree)
  },
  apercuCarte: () => {
    const etat = cartes()[1]?.etat ?? null
    return () => apercuCarte(etat, MAINTENANT, REGLAGES)
  },
  noterCarte: () => {
    const etat = cartes()[1]?.etat ?? carteNeuve(MAINTENANT)
    return () => noterCarte(etat, 'bien', MAINTENANT, REGLAGES)
  },
  tirerDifferee: () => {
    const poses = faits
      .slice(0, nCartes)
      .map((fait, i) => ({ question: `DE${String((i % 3) + 1)}`, date: fait.date }))
    const reglages = { ...REGLAGES, joursAvantReutilisation: 1 }
    return () => tirerDifferee(premier.manifeste, 'explication', poses, MAINTENANT, reglages)
  },
}

const preparer = scenarios[scenario]
if (preparer === undefined) {
  console.error(`Scénarios : ${Object.keys(scenarios).join(', ')}`)
  exit(2)
}
const fonction = preparer()

const temps: number[] = []
let total = 0
fonction() // chauffe : compilation JIT, caches
while (temps.length < 3 || (total < budgetMs && temps.length < 2000)) {
  const debut = hrtime.bigint()
  fonction()
  const ms = Number(hrtime.bigint() - debut) / 1e6
  temps.push(ms)
  total += ms
  if (ms > budgetMs) break
}
temps.sort((a, b) => a - b)
console.log(
  JSON.stringify({
    scenario,
    n: faits.length,
    blocs: nBlocs,
    ms: Number((temps[Math.floor(temps.length / 2)] ?? 0).toFixed(4)),
    min: Number((temps[0] ?? 0).toFixed(4)),
    iterations: temps.length,
  }),
)
