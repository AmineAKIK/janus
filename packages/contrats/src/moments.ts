import type { TypeEtape } from './manifeste.ts'

/**
 * Les quatre moments d'un bloc, dans l'ordre de la méthode : découvrir (carte, perception),
 * comprendre (pré-test, explication), s'entraîner (pratique, atelier, aisance, puis ensemble : ajuster
 * en fin de bloc, règle C08), prouver (restitution, bilan). L'appli les affiche
 * au-dessus du fil d'étapes.
 */
export const MOMENTS = [
  { id: 'decouvrir', libelle: 'Découvrir' },
  { id: 'comprendre', libelle: 'Comprendre' },
  { id: 'entrainer', libelle: 'S’entraîner' },
  { id: 'prouver', libelle: 'Prouver' },
] as const
export type Moment = (typeof MOMENTS)[number]
export type IdMoment = Moment['id']

const [DECOUVRIR, COMPRENDRE, ENTRAINER, PROUVER] = MOMENTS

const MOMENT_DE_L_ETAPE: Readonly<Record<TypeEtape, Moment>> = {
  carte: DECOUVRIR,
  perception: DECOUVRIR,
  pretest: COMPRENDRE,
  explication: COMPRENDRE,
  pratique: ENTRAINER,
  atelier: ENTRAINER,
  aisance: ENTRAINER,
  ensemble: ENTRAINER,
  restitution: PROUVER,
  bilan: PROUVER,
}

/** Le moment auquel appartient une étape, d'après son type. */
export function momentDeLEtape(type: TypeEtape): Moment {
  return MOMENT_DE_L_ETAPE[type]
}
