import type { Statut } from '@janus/contrats'

/** Nom de la classe CSS qui colore chaque statut, identique dans tous les modules qui le colorent. */
export const CLASSE_STATUT: Record<Statut, string> = {
  non_commence: 'nonCommence',
  en_cours: 'enCours',
  vu: 'vu',
  acquis_provisoirement: 'acquisProvisoirement',
  acquis: 'acquis',
  maitrise: 'maitrise',
  a_reprendre: 'aReprendre',
}
