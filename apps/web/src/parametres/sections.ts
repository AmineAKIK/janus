import { modeTransport } from '../api/client.ts'

const SECTIONS_BASE = [
  { cle: 'compte', titre: 'Compte' },
  { cle: 'rappels', titre: 'Rappels' },
  { cle: 'revision', titre: 'Révision' },
  { cle: 'regles', titre: 'Règles de la méthode' },
  { cle: 'ia', titre: 'Correction IA' },
  { cle: 'affichage', titre: 'Affichage' },
  { cle: 'hors-ligne', titre: 'Hors ligne' },
  { cle: 'donnees', titre: 'Données' },
  { cle: 'zone', titre: 'Zone sensible' },
] as const

const SECTION_DEMO = { cle: 'demo', titre: 'Démo' } as const

/** Les sections de la page ; « Démo » seulement avec `VITE_TRANSPORT=demo`. */
export const SECTIONS: readonly { readonly cle: CleSection; readonly titre: string }[] = [
  ...SECTIONS_BASE,
  ...(modeTransport(import.meta.env.VITE_TRANSPORT) === 'demo' ? [SECTION_DEMO] : []),
]

export type CleSection = (typeof SECTIONS_BASE)[number]['cle'] | typeof SECTION_DEMO.cle

export const estSection = (valeur: string | undefined): valeur is CleSection =>
  SECTIONS.some(({ cle }) => cle === valeur)
