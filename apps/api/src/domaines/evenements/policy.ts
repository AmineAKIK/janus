import { createHash } from 'node:crypto'
import type { MessagePage, TempsActif } from '@janus/contrats'

export type Message = MessagePage | TempsActif

/** Les messages qui ont leur propre route : ils n'entrent pas par `POST /evenements`. */
export const MESSAGES_AILLEURS: Readonly<Record<string, string>> = {
  'etat.sauver': 'PUT /blocs/:id/etat-page',
  'restitution.demande': 'POST /corrections',
  'correction.accord': 'POST /corrections/:id/accord',
}

function canonique(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canonique)
  if (typeof valeur === 'object' && valeur !== null) {
    return Object.fromEntries(
      Object.entries(valeur)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cle, contenu]) => [cle, canonique(contenu)]),
    )
  }
  return valeur
}

/** L'empreinte du contenu d'un message : le même message renvoyé donne la même, quel que soit l'ordre des champs. */
export function empreinteDuMessage(message: Message): string {
  return createHash('sha256')
    .update(JSON.stringify(canonique(message)))
    .digest('hex')
}

/** Ce que l'événement garde : le type stocké, les données utiles, le niveau d'aide. */
export interface Enregistrement {
  readonly type: string
  readonly donnees: Readonly<Record<string, unknown>>
  readonly aide: number | null
  /** Vrai si ce fait change le statut du bloc : il faut alors recalculer. */
  readonly changeLeStatut: boolean
}

/** Les types de fait du moteur (`etape_vue`...) gardent leurs champs ; les autres messages sont gardés tels quels. */
export function enregistrementDe(message: Message): Enregistrement {
  switch (message.type) {
    case 'etape.vue':
      return {
        type: 'etape_vue',
        donnees: { etape: message.etape },
        aide: null,
        changeLeStatut: true,
      }
    case 'pratique.resultat':
      return {
        type: 'pratique_resultat',
        donnees: {
          exercice: message.exercice,
          item: message.item,
          reussi: message.reussi,
          aide: message.aide,
        },
        aide: message.aide,
        changeLeStatut: true,
      }
    case 'atelier.resultat':
      return {
        type: 'atelier_resultat',
        donnees: { reussi: message.reussi, aide: message.aide },
        aide: message.aide,
        changeLeStatut: true,
      }
    case 'aisance.resultat':
      return {
        type: 'aisance_resultat',
        donnees: { reussi: message.reussi, dureeS: message.duree_s },
        aide: null,
        changeLeStatut: true,
      }
    case 'bilan.erreurs':
      return {
        type: 'bilan.erreurs',
        donnees: { ids: message.ids },
        aide: null,
        changeLeStatut: true,
      }
    case 'temps.actif':
      return {
        type: 'temps.actif',
        donnees: {
          secondes: message.secondes,
          ...(message.etape === undefined ? {} : { etape: message.etape }),
        },
        aide: null,
        changeLeStatut: false,
      }
    default:
      return { type: message.type, donnees: {}, aide: null, changeLeStatut: false }
  }
}

/**
 * Le bilan des erreurs critiques : les cases cochées deviennent des erreurs ouvertes, les cases
 * décochées ferment celles qui l'étaient. Le dernier état fait foi.
 */
export function decisionsDuBilan(ouvertes: readonly string[], cochees: readonly string[]) {
  return {
    aCocher: cochees.filter((erreur) => !ouvertes.includes(erreur)),
    aDecocher: ouvertes.filter((erreur) => !cochees.includes(erreur)),
  }
}

/** Vrai si l'IA a repéré cette erreur dans la correction (`erreurs_ids` est un tableau JSON). */
export function erreurProposee(erreursIds: unknown, erreur: string): boolean {
  return Array.isArray(erreursIds) && erreursIds.includes(erreur)
}
