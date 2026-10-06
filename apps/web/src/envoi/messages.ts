import { ROUTES } from '@janus/contrats'
import type { Manque, MessagePage, Statut } from '@janus/contrats'

/** Ce qu'il faut garder pour envoyer un message de la page : la route, ses paramètres et son corps. */
export interface EnvoiDeMessage {
  readonly route: string
  readonly params?: Readonly<Record<string, string>>
  readonly corps: unknown
  readonly cle?: string
}

/**
 * La route de chaque message de la page. L'état d'une page garde une seule entrée par bloc ;
 * une demande de restitution devient une demande de correction, de tentative 1 (le cadrage ne
 * dit pas encore comment compter les tentatives d'une série).
 */
export function envoiDeMessage(message: MessagePage, versionEtat: number): EnvoiDeMessage {
  switch (message.type) {
    case 'etat.sauver':
      return {
        route: 'PUT /blocs/:id/etat-page',
        params: { id: message.bloc },
        corps: { version: versionEtat, etat: message.etat },
        cle: `etat:${message.bloc}`,
      }
    case 'bilan.erreurs':
      return {
        route: 'POST /blocs/:id/erreurs',
        params: { id: message.bloc },
        corps: { id: message.id, ids: message.ids },
      }
    case 'correction.accord':
      return {
        route: 'POST /corrections/:id/accord',
        params: { id: message.correction },
        corps: { accord: message.accord },
      }
    case 'restitution.demande':
      return {
        route: 'POST /corrections',
        corps: {
          id: message.id,
          serie: message.serie,
          tentative: 1,
          question: message.question,
          reponse: message.reponse,
          confiance: message.confiance,
          relance: message.relance,
          support: message.support,
          bloc: message.bloc,
          version: message.version,
        },
      }
    default:
      return { route: 'POST /evenements', corps: message }
  }
}

/** Le statut recalculé que porte la réponse du serveur à un message, s'il y en a un. */
export function statutDeReponse(
  route: string,
  reponse: unknown,
): { readonly statut: Statut; readonly manque: readonly Manque[] } | null {
  if (route === 'POST /evenements') {
    const { statut } = ROUTES['POST /evenements'].reponse.parse(reponse)
    return statut === null ? null : { statut: statut.statut, manque: statut.manque }
  }
  if (route === 'POST /blocs/:id/erreurs') {
    const { statut, manque } = ROUTES['POST /blocs/:id/erreurs'].reponse.parse(reponse)
    return { statut, manque }
  }
  return null
}
