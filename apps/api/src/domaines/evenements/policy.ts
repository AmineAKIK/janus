import { canonique } from '@janus/contrats'
import { empreinteJson } from '../../base/empreinte.ts'
import type { Manifeste, MessagePage, TempsActif } from '@janus/contrats'

export type Message = MessagePage | TempsActif

/** Les messages qui ont leur propre route : ils n'entrent pas par `POST /evenements`. */
export const MESSAGES_AILLEURS: Readonly<Record<string, string>> = {
  'etat.sauver': 'PUT /blocs/:id/etat-page',
  'restitution.demande': 'POST /corrections',
  'correction.accord': 'POST /corrections/:id/accord',
  'lien.ouvrir': 'l’appli seule : il ne part jamais au serveur',
}

/** L'empreinte du contenu d'un message : le même message renvoyé donne la même, quel que soit l'ordre des champs. */
export function empreinteDuMessage(message: Message): string {
  return empreinteJson(canonique(message))
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
    case 'pretest.reponse':
      return {
        type: 'pretest.reponse',
        donnees: { question: message.question, reponse: message.reponse },
        aide: null,
        changeLeStatut: false,
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

/** `page.prete` dit seulement que la page est chargée : rien à garder, le statut n'en dépend pas. */
export function estSansEffet(message: Message): boolean {
  return message.type === 'page.prete'
}

/**
 * Ce que le message cite et que la version du manifeste ne connaît pas (étape, exercice, item,
 * atelier, aisance, erreur critique), ou `undefined` si tout est connu. Le moteur ne doit jamais
 * recevoir un fait sur un élément qui n'existe pas.
 */
export function incoherence(message: Message, manifeste: Manifeste): string | undefined {
  switch (message.type) {
    case 'etape.vue':
      return manifeste.etapes.some(({ id }) => id === message.etape)
        ? undefined
        : `l'étape « ${message.etape} »`
    case 'pratique.resultat': {
      const exercice = manifeste.pratique.find(({ id }) => id === message.exercice)
      if (exercice === undefined) return `l'exercice « ${message.exercice} »`
      return exercice.items.some(({ id }) => id === message.item)
        ? undefined
        : `l'item « ${message.item} » de l'exercice « ${message.exercice} »`
    }
    case 'atelier.resultat':
      return manifeste.atelier === undefined ? "un atelier (il n'en a pas)" : undefined
    case 'aisance.resultat':
      return manifeste.aisance === undefined ? "un exercice d'aisance (il n'en a pas)" : undefined
    case 'bilan.erreurs': {
      const connues = new Set(manifeste.erreurs_critiques.map(({ id }) => id))
      const inconnues = message.ids.filter((id) => !connues.has(id))
      return inconnues.length === 0 ? undefined : `l'erreur « ${inconnues.join('», «')} »`
    }
    default:
      return undefined
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
