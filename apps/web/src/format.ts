import { ecartEnJours } from '@janus/moteur'

const MOIS = [
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
]

/**
 * Une date pour l'écran : « aujourd’hui », « demain », sinon « 1 nov. » (avec l'année si ce n'est
 * pas l'année en cours). Les deux arguments sont des jours « AAAA-MM-JJ ».
 */
export function formaterDate(jour: string, aujourdhui: string): string {
  const ecart = ecartEnJours(aujourdhui, jour)
  if (ecart === 0) return 'aujourd’hui'
  if (ecart === 1) return 'demain'
  const [annee = '', mois = '1', numero = '1'] = jour.split('-')
  const texte = `${String(Number(numero))} ${MOIS[Number(mois) - 1] ?? ''}`
  return annee === aujourdhui.slice(0, 4) ? texte : `${texte} ${annee}`
}
