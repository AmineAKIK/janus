import type { NoteCarte } from '@janus/contrats'
import { accorder } from '../catalogue/calculs.ts'

export const TEXTES_REVISION = {
  titre: 'Révision',
  quitter: 'Quitter',
  voirReponse: 'Voir la réponse',
  nouvelle: 'Nouvelle',
  annuler: 'Annuler',
  aucune: 'Aucune carte due.',
  chargement: 'Chargement…',
  cartesARevoir: 'Cartes à revoir',
  reviennentAvant: 'Elles reviennent avant la fin de cette séance.',
  revoirOuPlusTard: 'Tu peux les revoir maintenant ou reprendre plus tard.',
  revoirMaintenant: 'Les revoir maintenant',
  plusTard: 'Plus tard',
  reviennentBientot: 'Les cartes à revoir reviennent dans quelques minutes.',
  etapeSuivante: 'Étape suivante',
  dialogueTitre: 'Quitter la séance ?',
  dialogueTexte: 'Tes notes sont gardées.',
  continuer: 'Continuer',
  recto: 'Question',
  verso: 'Réponse',
} as const

export const NOTES: readonly { readonly note: NoteCarte; readonly libelle: string }[] = [
  { note: 'a_revoir', libelle: 'À revoir' },
  { note: 'difficile', libelle: 'Difficile' },
  { note: 'bien', libelle: 'Bien' },
  { note: 'facile', libelle: 'Facile' },
]

export const LIBELLES_NOTE: Readonly<Record<NoteCarte, string>> = {
  a_revoir: 'À revoir',
  difficile: 'Difficile',
  bien: 'Bien',
  facile: 'Facile',
}

const MS_PAR_MINUTE = 60_000
const MINUTES_PAR_HEURE = 60
const HEURES_PAR_JOUR = 24
const JOURS_PAR_MOIS = 30

/** « 10 min », « 3 h », « 4 j », puis des mois au-delà de 30 jours. */
export function texteIntervalle(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PAR_MINUTE))
  if (minutes < MINUTES_PAR_HEURE) return `${String(minutes)} min`
  const heures = Math.round(minutes / MINUTES_PAR_HEURE)
  if (heures < HEURES_PAR_JOUR) return `${String(heures)} h`
  const jours = Math.round(heures / HEURES_PAR_JOUR)
  if (jours <= JOURS_PAR_MOIS) return `${String(jours)} j`
  return `${String(Math.round(jours / JOURS_PAR_MOIS))} mois`
}

export const texteProgression = (rang: number, total: number, nouvelles: number) =>
  `${String(rang)} sur ${String(total)} · dont ${String(nouvelles)} ${nouvelles < 2 ? 'nouvelle' : 'nouvelles'}`

export const texteBandeau = (note: NoteCarte, intervalle: string) =>
  `Notée ${LIBELLES_NOTE[note]} · revient dans ${intervalle}`

export const texteCartesRevues = (nombre: number) =>
  accorder(nombre, 'carte revue', 'cartes revues')

export const texteReviennentDans = (nombre: number, delai: string) =>
  `${accorder(nombre, 'carte revient', 'cartes reviennent')} dans ${delai}`

const MOIS_COURTS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const

/** « 8 oct. » depuis un jour `AAAA-MM-JJ`. */
export function texteJourCourt(jour: string): string {
  const [, mois = 1, numero = 1] = jour.split('-').map(Number)
  return `${String(numero)} ${MOIS_COURTS[mois - 1] ?? ''}`
}

/** « La prochaine arrive demain » ou « La prochaine arrive le 8 oct. » depuis des jours `AAAA-MM-JJ`. */
export function texteProchaine(jourDeLaCarte: string, ecart: number): string {
  if (ecart <= 0) return 'La prochaine arrive aujourd’hui'
  if (ecart === 1) return 'La prochaine arrive demain'
  return `La prochaine arrive le ${texteJourCourt(jourDeLaCarte)}`
}

/** « 1 à revoir, 2 difficiles, 3 bien, 4 faciles » : la dernière note de chaque carte. */
export function texteRepartition(revues: readonly { readonly note: NoteCarte }[]): string {
  const nombre = (note: NoteCarte) => revues.filter((revue) => revue.note === note).length
  return [
    `${String(nombre('a_revoir'))} à revoir`,
    accorder(nombre('difficile'), 'difficile', 'difficiles'),
    `${String(nombre('bien'))} bien`,
    accorder(nombre('facile'), 'facile', 'faciles'),
  ].join(', ')
}
