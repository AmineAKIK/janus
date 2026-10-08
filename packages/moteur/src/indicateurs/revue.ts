import type { Manifeste, Reglages, TypeEtape } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { calculerBloc } from '../statut.ts'
import { instantEnMs } from '../temps.ts'
import { GROUPE_DE_L_ETAPE } from './temps.ts'
import type { MesureTemps } from './temps.ts'

/** Un type d'étape est « souvent sauté » quand il l'est dans au moins ce nombre de blocs vus. */
export const BLOCS_POUR_SOUVENT_SAUTEE = 2
/** Une notion est « à reprendre plusieurs fois » à partir de ce nombre de fois. */
export const FOIS_POUR_PLUSIEURS = 2

export interface NotionARepreendre {
  readonly bloc: string
  readonly question: string
  /** Combien de fois sa correction de premier tour n'était pas solide depuis la dernière revue. */
  readonly fois: number
}

export interface EtapeSautee {
  readonly etape: TypeEtape
  /** Dans combien de blocs vus cette étape n'a jamais été vue. */
  readonly blocs: number
}

export interface RevueMethode {
  /** Les blocs passés à Vu depuis la dernière revue. */
  readonly blocsDepuis: number
  /** Le réglage `blocsEntreRevues` : combien de blocs avant de proposer la revue. */
  readonly blocsRequis: number
  /** Vrai quand `blocsDepuis` atteint `blocsRequis`. */
  readonly aProposer: boolean
  /** Le temps actif depuis la dernière revue, dont celui passé à pratiquer. */
  readonly tempsS: number
  readonly pratiqueS: number
  readonly aReprendre: readonly NotionARepreendre[]
  readonly etapesSautees: readonly EtapeSautee[]
}

/**
 * « Revue de la méthode » : ce qui s'est passé depuis la dernière revue (`null` : jamais faite).
 * Les blocs « passés à Vu » sont comptés à chaque passage au statut calculé Vu, fait après fait.
 */
export function revueMethode(
  faits: readonly Fait[],
  mesures: readonly MesureTemps[],
  manifestes: readonly Manifeste[],
  derniereRevue: string | null,
  reglages: Reglages,
): RevueMethode {
  const depuis = derniereRevue === null ? Number.NEGATIVE_INFINITY : instantEnMs(derniereRevue)
  const apresRevue = (date: string) => instantEnMs(date) > depuis
  let blocsDepuis = 0
  const sautees = new Map<TypeEtape, number>()
  for (const manifeste of manifestes) {
    const duBloc = faits
      .filter((fait) => fait.bloc === manifeste.bloc)
      .sort((a, b) => instantEnMs(a.date) - instantEnMs(b.date))
    let precedent = false
    for (const [rang, fait] of duBloc.entries()) {
      const vu =
        calculerBloc(duBloc.slice(0, rang + 1), manifeste, reglages, fait.date).statutCalcule ===
        'vu'
      if (vu && !precedent && apresRevue(fait.date)) blocsDepuis += 1
      precedent = vu
    }
    if (precedent) {
      const vues = new Set(
        duBloc.flatMap((fait) => (fait.type === 'etape_vue' ? [fait.etape] : [])),
      )
      const types = new Set(
        manifeste.etapes.filter(({ id }) => !vues.has(id)).map(({ type }) => type),
      )
      for (const type of types) sautees.set(type, (sautees.get(type) ?? 0) + 1)
    }
  }
  const reprises = new Map<string, NotionARepreendre>()
  for (const fait of faits) {
    if (fait.type !== 'correction' || fait.tour !== 1 || fait.niveau === 'solide') continue
    if (!apresRevue(fait.date)) continue
    const cle = `${fait.bloc}|${fait.question}`
    const vue = reprises.get(cle)
    reprises.set(cle, {
      bloc: fait.bloc,
      question: fait.question,
      fois: (vue?.fois ?? 0) + 1,
    })
  }
  const recentes = mesures.filter(({ date }) => apresRevue(date))
  return {
    blocsDepuis,
    blocsRequis: reglages.blocsEntreRevues,
    aProposer: blocsDepuis >= reglages.blocsEntreRevues,
    tempsS: recentes.reduce((total, { secondes }) => total + secondes, 0),
    pratiqueS: recentes
      .filter(({ etape }) => etape !== undefined && GROUPE_DE_L_ETAPE[etape] === 'pratique')
      .reduce((total, { secondes }) => total + secondes, 0),
    aReprendre: [...reprises.values()]
      .filter(({ fois }) => fois >= FOIS_POUR_PLUSIEURS)
      .sort(
        (a, b) =>
          b.fois - a.fois || a.bloc.localeCompare(b.bloc) || a.question.localeCompare(b.question),
      ),
    etapesSautees: [...sautees]
      .filter(([, blocs]) => blocs >= BLOCS_POUR_SOUVENT_SAUTEE)
      .map(([etape, blocs]) => ({ etape, blocs }))
      .sort((a, b) => b.blocs - a.blocs || a.etape.localeCompare(b.etape)),
  }
}
