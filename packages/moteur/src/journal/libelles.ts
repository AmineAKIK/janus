import type { Statut } from '@janus/contrats'

/** Le statut d'un bloc tel que le journal et son export le nomment. */
export const LIBELLES_STATUT: Readonly<Record<Statut, string>> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  vu: 'Vu',
  acquis_provisoirement: 'Acquis provisoirement',
  acquis: 'Acquis',
  maitrise: 'Maîtrisé',
  a_reprendre: 'À reprendre',
}
