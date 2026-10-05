import type { Manifeste, Reglages } from '@janus/contrats'
import type { Fait } from './faits.ts'
import { comparer } from './ordre.ts'
import { instantEnMs } from './temps.ts'

/** Un bloc au moins « vu », et s'il est un prérequis du bloc en cours. */
export interface BlocVu {
  readonly manifeste: Manifeste
  readonly prerequisDuBlocEnCours: boolean
}

/** Une question de début de séance, et pourquoi elle a été choisie (1 est la plus urgente). */
export interface QuestionDebut {
  readonly bloc: string
  readonly question: string
  readonly priorite: 1 | 2 | 3 | 4
}

type Correction = Extract<Fait, { type: 'correction' }>

/** Générateur pseudo-aléatoire déterministe (mulberry32) : une même graine donne la même suite. */
function generateur(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function melanger<T>(elements: readonly T[], hasard: () => number): T[] {
  return elements
    .map((element) => ({ element, cle: hasard() }))
    .sort((a, b) => a.cle - b.cle)
    .map(({ element }) => element)
}

const rate = (correction: Correction) =>
  correction.niveau === 'fragile' || correction.niveau === 'pas_encore'

function plusAncienne(a: Correction, b: Correction): number {
  return instantEnMs(a.date) - instantEnMs(b.date) || comparer(a.id, b.id)
}

/**
 * Choisit `questionsDebut` questions dans les réserves `rappel` des blocs vus, par priorité :
 * 1. dernière réponse ratée ou fragile (`fragile`, `pas_encore`) ;
 * 2. erreur déjà faite en étant « sûr » ;
 * 3. bloc prérequis du bloc en cours ;
 * 4. le reste.
 * À priorité égale le tirage est au hasard, mais déterministe pour une même graine. Dès que deux blocs
 * sont vus, le résultat est mélangé entre blocs ; sinon il reste dans l'ordre des priorités.
 */
export function choisirQuestionsDebut(
  blocsVus: readonly BlocVu[],
  historique: readonly Fait[],
  reglages: Reglages,
  graine: number,
): QuestionDebut[] {
  const hasard = generateur(graine)
  const corrections = historique
    .filter((fait): fait is Correction => fait.type === 'correction')
    .sort(plusAncienne)
  const candidates = blocsVus.flatMap(({ manifeste, prerequisDuBlocEnCours }) =>
    manifeste.rappel.map((question): QuestionDebut => {
      const reponses = corrections.filter(
        (correction) => correction.bloc === manifeste.bloc && correction.question === question.id,
      )
      const derniere = reponses.at(-1)
      let priorite: QuestionDebut['priorite'] = 4
      if (prerequisDuBlocEnCours) priorite = 3
      if (reponses.some((reponse) => reponse.confiance === 'sur' && rate(reponse))) priorite = 2
      if (derniere !== undefined && rate(derniere)) priorite = 1
      return { bloc: manifeste.bloc, question: question.id, priorite }
    }),
  )
  const choisies = melanger(candidates, hasard)
    .sort((a, b) => a.priorite - b.priorite)
    .slice(0, reglages.questionsDebut)
  return blocsVus.length >= 2 ? melanger(choisies, hasard) : choisies
}
