export const SECTIONS = [
  { cle: 'revision', titre: 'Révision' },
  { cle: 'regles', titre: 'Règles de la méthode' },
  { cle: 'affichage', titre: 'Affichage' },
] as const

export type CleSection = (typeof SECTIONS)[number]['cle']

export const estSection = (valeur: string | undefined): valeur is CleSection =>
  SECTIONS.some(({ cle }) => cle === valeur)
