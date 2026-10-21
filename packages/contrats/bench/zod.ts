import { readFileSync } from 'node:fs'
import { hrtime } from 'node:process'
import { Fait, Manifeste, Reglages } from '../src/index.ts'

// Coût de Zod aux frontières : combien coûte un parse de manifeste, de fait, de réglages, et ce que
// coûte d'en faire des centaines à chaque lecture.
//   node bench/zod.ts

function mesurer(nom: string, iterations: number, travail: () => unknown): void {
  travail()
  const temps: number[] = []
  for (let i = 0; i < 5; i += 1) {
    const debut = hrtime.bigint()
    for (let j = 0; j < iterations; j += 1) travail()
    temps.push(Number(hrtime.bigint() - debut) / iterations)
  }
  temps.sort((a, b) => a - b)
  const ns = temps[0] ?? 0
  console.log(`${nom.padEnd(58)} ${(ns / 1000).toFixed(2).padStart(10)} µs/appel`)
}

const demo: unknown = JSON.parse(
  readFileSync(new URL('../fixtures/manifeste-demo.json', import.meta.url), 'utf8'),
)
if (typeof demo !== 'object' || demo === null) throw new Error('Manifeste illisible')

const question = (prefixe: string, i: number) => ({
  id: `${prefixe}${String(i)}`,
  question: `Question ${prefixe}${String(i)} ?`,
  attendu: `Réponse attendue ${prefixe}${String(i)}.`,
  erreurs: ['E1', 'E2'],
})
/** Un manifeste de la taille d'une vraie fiche : 30 étapes, 40 questions, 40 items, 40 cartes. */
const gros: unknown = {
  ...demo,
  etapes: Array.from({ length: 30 }, (_, i) => ({
    id: `ET${String(i)}`,
    titre: `Étape ${String(i)}`,
    type: 'explication',
  })),
  restitution: Array.from({ length: 10 }, (_, i) => question('R', i)),
  rappel: Array.from({ length: 10 }, (_, i) => question('RA', i)),
  differees: Array.from({ length: 12 }, (_, i) => ({
    id: `DE${String(i)}`,
    type: 'explication',
    consigne: `Consigne ${String(i)}`,
    attendu: `Attendu ${String(i)}`,
    erreurs: ['E1'],
  })),
  pratique: Array.from({ length: 4 }, (_, i) => ({
    id: `PR${String(i)}`,
    titre: `Pratique ${String(i)}`,
    items: Array.from({ length: 10 }, (_, k) => ({ id: `PR${String(i)}-${String(k)}` })),
    reussite: 5,
  })),
  cartes: Array.from({ length: 40 }, (_, i) => ({
    id: `CA${String(i)}`,
    recto: `Recto ${String(i)}`,
    verso: `Verso ${String(i)}`,
  })),
}

mesurer('Manifeste.parse (manifeste de démo, 9 étapes)', 2000, () => Manifeste.parse(demo))
mesurer('Manifeste.parse (manifeste de taille réelle)', 500, () => Manifeste.parse(gros))
mesurer('150 × Manifeste.parse (une lecture du suivi, 150 blocs)', 5, () => {
  for (let i = 0; i < 150; i += 1) Manifeste.parse(gros)
})
mesurer('Reglages.parse({}) (valeurs par défaut)', 5000, () => Reglages.parse({}))
const reglagesStockes = Reglages.parse({})
mesurer('Reglages.parse(réglages stockés)', 5000, () => Reglages.parse(reglagesStockes))

const faitCorrection = {
  id: 'f1',
  bloc: 'B01',
  date: '2026-06-01T10:00:00Z',
  type: 'correction',
  serie: 'restitution',
  question: 'R1',
  tour: 1,
  niveau: 'solide',
  compte: true,
  confiance: 'sur',
  erreursIa: [],
}
const faitVerification = {
  id: 'f2',
  bloc: 'B01',
  date: '2026-06-01T10:00:00Z',
  type: 'verification_terminee',
  verification: 'verification',
  valable: true,
  reponses: [
    { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
    { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
    { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
  ],
}
const faitEtape = {
  id: 'f3',
  bloc: 'B01',
  date: '2026-06-01T10:00:00Z',
  type: 'etape_vue',
  etape: 'ET1',
}
mesurer('Fait.parse (correction)', 20000, () => Fait.parse(faitCorrection))
mesurer('Fait.parse (vérification, 3 réponses)', 10000, () => Fait.parse(faitVerification))
mesurer('Fait.parse (étape vue)', 20000, () => Fait.parse(faitEtape))
mesurer('100 000 × Fait.parse (mélange 60 % étapes, 35 % corrections, 5 % vérifs)', 1, () => {
  for (let i = 0; i < 100_000; i += 1) {
    const r = i % 20
    Fait.parse(r < 12 ? faitEtape : r < 19 ? faitCorrection : faitVerification)
  }
})
