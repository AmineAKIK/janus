import { readFileSync } from 'node:fs'
import { Manifeste, Reglages } from '@janus/contrats'
import type { Fait, Niveau } from '@janus/contrats'
import type { BlocImporte } from '../src/composition/bloc.ts'
import { instantEnIso, instantEnMs } from '../src/temps.ts'

// Jeux de faits reproductibles pour les micro-benchmarks (voir bench/README.md).
// Aucune horloge : tout vient de la graine.

const FIXTURE = new URL('../../contrats/fixtures/manifeste-demo.json', import.meta.url)
export const MANIFESTE_BASE = Manifeste.parse(JSON.parse(readFileSync(FIXTURE, 'utf8')))
export const REGLAGES = Reglages.parse({})
export const DEBUT = '2025-01-06T10:00:00Z'
export const MAINTENANT = '2026-12-01T10:00:00Z'

export function generateur(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const NIVEAUX: readonly Niveau[] = [
  'solide',
  'solide',
  'solide',
  'partiel',
  'fragile',
  'pas_encore',
]
const MS_JOUR = 86_400_000
const MIN = 60_000

export interface JeuDeFaits {
  readonly blocs: BlocImporte[]
  readonly faits: Fait[]
  readonly modules: { id: string; titre: string }[]
}

/** `nBlocs` blocs (manifeste de démo renommé), `faitsParBloc` faits chacun, étalés sur ~2 ans. */
export function jeuDeFaits(nBlocs: number, faitsParBloc: number, graine = 42): JeuDeFaits {
  const hasard = generateur(graine)
  const choix = <T>(liste: readonly T[]): T => liste[Math.floor(hasard() * liste.length)] as T
  const blocs: BlocImporte[] = []
  const faits: Fait[] = []
  let numero = 0
  const id = () => `f${String((numero += 1)).padStart(8, '0')}`
  const debut = instantEnMs(DEBUT)

  for (let b = 0; b < nBlocs; b += 1) {
    const code = `B${String(b).padStart(3, '0')}`
    const manifeste: Manifeste = {
      ...MANIFESTE_BASE,
      bloc: code,
      prerequis: b > 0 && b % 3 === 0 ? [`B${String(b - 1).padStart(3, '0')}`] : [],
    }
    blocs.push({
      code,
      moduleCode: `M${String(Math.floor(b / 10))}`,
      partie: '1.1 Partie',
      manifeste,
    })
    const ajout: Fait[] = []
    const t0 = debut + Math.floor(hasard() * 30) * MS_JOUR
    const commun = (ms: number) => ({ id: id(), bloc: code, date: instantEnIso(ms) })
    // Chronologie type jusqu'à « maîtrisé », puis du remplissage aléatoire.
    for (const [i, e] of manifeste.etapes.slice(0, 3).entries()) {
      ajout.push({ ...commun(t0 + i * MIN), type: 'etape_vue', etape: e.id })
    }
    for (let i = 0; i < 2; i += 1) {
      ajout.push({
        ...commun(t0 + (5 + i) * MIN),
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: `PR1-${String(i + 1)}`,
        reussi: true,
        aide: 0,
      })
    }
    ajout.push({ ...commun(t0 + 8 * MIN), type: 'atelier_resultat', reussi: true, aide: 0 })
    for (const [i, q] of manifeste.restitution.entries()) {
      ajout.push({
        ...commun(t0 + (30 + i) * MIN),
        type: 'correction',
        serie: 'restitution',
        question: q.id,
        tour: 1,
        niveau: 'solide',
        compte: true,
        confiance: 'sur',
        erreursIa: [],
      })
    }
    for (const [i, q] of manifeste.consolidation.entries()) {
      ajout.push({
        ...commun(t0 + (200 + i) * MIN),
        type: 'correction',
        serie: 'consolidation',
        question: q.id,
        tour: 1,
        niveau: 'solide',
        compte: true,
        confiance: 'sur',
        erreursIa: [],
      })
    }
    const reponses = [
      {
        type: 'explication' as const,
        question: 'DE1',
        tour: 1,
        niveau: 'solide' as const,
        compte: true,
      },
      { type: 'tache' as const, question: 'DT1', tour: 1, reussi: true, compte: true },
      {
        type: 'transfert' as const,
        question: 'DR1',
        tour: 1,
        niveau: 'solide' as const,
        compte: true,
      },
    ]
    ajout.push({
      ...commun(t0 + 5 * MS_JOUR),
      type: 'verification_terminee',
      verification: 'verification',
      valable: true,
      reponses,
    })
    ajout.push({
      ...commun(t0 + 40 * MS_JOUR),
      type: 'verification_terminee',
      verification: 'retest',
      valable: true,
      reponses,
    })
    ajout.push({ ...commun(t0 + 41 * MS_JOUR), type: 'aisance_resultat', reussi: true, dureeS: 20 })
    ajout.push({ ...commun(t0 + 42 * MS_JOUR), type: 'aisance_resultat', reussi: true, dureeS: 22 })

    const premiereCorrection = ajout.find((fait) => fait.type === 'correction')
    while (ajout.length < faitsParBloc) {
      // Des séances : un jour au hasard sur ~600, une heure au hasard dans le jour.
      const ms =
        t0 +
        45 * MS_JOUR +
        Math.floor(hasard() * 600) * MS_JOUR +
        Math.floor(hasard() * 20 * 60) * MIN
      const c = commun(ms)
      const r = hasard()
      if (r < 0.2) ajout.push({ ...c, type: 'etape_vue', etape: choix(manifeste.etapes).id })
      else if (r < 0.4) {
        ajout.push({
          ...c,
          type: 'pratique_resultat',
          exercice: 'PR1',
          item: `PR1-${String(1 + Math.floor(hasard() * 3))}`,
          reussi: hasard() < 0.7,
          aide: choix([0, 0, 1, 2, 3, 4] as const),
        })
      } else if (r < 0.7) {
        const serie = choix(['rappel', 'rappel', 'restitution', 'consolidation'] as const)
        const questions =
          serie === 'rappel'
            ? manifeste.rappel
            : serie === 'restitution'
              ? manifeste.restitution
              : manifeste.consolidation
        ajout.push({
          ...c,
          type: 'correction',
          serie,
          question: choix(questions).id,
          tour: hasard() < 0.85 ? 1 : 2,
          niveau: choix(NIVEAUX),
          compte: hasard() < 0.9,
          confiance: choix(['sur', 'hesitant', 'hasard'] as const),
          erreursIa: hasard() < 0.1 ? ['E1'] : [],
        })
      } else if (r < 0.75) {
        ajout.push({
          ...c,
          type: 'aisance_resultat',
          reussi: hasard() < 0.6,
          dureeS: 15 + hasard() * 30,
        })
      } else if (r < 0.79) {
        ajout.push({
          ...c,
          type: 'erreur_cochee',
          erreur: choix(['E1', 'E2', 'E3']),
          source: 'amine',
        })
      } else if (r < 0.82) {
        ajout.push({
          ...c,
          type: 'erreur_decochee',
          erreur: choix(['E1', 'E2', 'E3']),
          source: 'amine',
        })
      } else if (r < 0.84) {
        ajout.push({ ...c, type: 'bloc_ouvert', horsPrerequis: hasard() < 0.2 })
      } else if (r < 0.89) {
        ajout.push({
          ...c,
          type: 'verification_terminee',
          verification: choix(['verification', 'retest', 'entretien'] as const),
          valable: hasard() < 0.9,
          reponses: reponses.map((x) => (hasard() < 0.8 ? x : { ...x, compte: false })),
        })
      } else if (r < 0.92) {
        if (premiereCorrection !== undefined) {
          ajout.push({ ...c, type: 'correction_contestee', correction: premiereCorrection.id })
        }
      } else if (r < 0.95) {
        if (premiereCorrection !== undefined) {
          ajout.push({
            ...c,
            type: 'correction_tranchee',
            correction: premiereCorrection.id,
            compte: hasard() < 0.5,
          })
        }
      } else if (r < 0.97) {
        ajout.push({ ...c, type: 'statut_force', statut: 'acquis', raison: 'Forcé pour le banc' })
      } else ajout.push({ ...c, type: 'force_levee' })
    }
    faits.push(...ajout)
  }
  const modules = [...new Set(blocs.map(({ moduleCode }) => moduleCode))].map((idModule) => ({
    id: idModule,
    titre: `Module ${idModule}`,
  }))
  return { blocs, faits, modules }
}
