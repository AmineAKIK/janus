import { MessagePage } from '@janus/contrats'

export interface ContexteFiltre {
  /** La fenêtre de l'iframe de la fiche affichée. */
  readonly fenetreFiche: unknown
  readonly bloc: string
  /** La version du manifeste importé. */
  readonly version: number
}

export type RefusMessage = 'source_inconnue' | 'schema' | 'bloc' | 'version'

export type ResultatFiltre =
  | { readonly accepte: true; readonly message: MessagePage }
  | { readonly accepte: false; readonly refus: RefusMessage }

/**
 * Décide si un message reçu par l'appli vient bien de la fiche affichée : la source est la fenêtre
 * de l'iframe, le message passe le schéma du pont, et il porte le bon bloc et la bonne version.
 * Seul `page.prete` échappe au contrôle du bloc, car la poignée de main n'a pas encore eu lieu.
 * Un refus venant d'une source inconnue ne reçoit pas de réponse (rien n'est dit à un tiers).
 */
export function filtrerMessage(
  evenement: { readonly source: unknown; readonly data: unknown },
  contexte: ContexteFiltre,
): ResultatFiltre {
  if (evenement.source === null || evenement.source !== contexte.fenetreFiche) {
    return { accepte: false, refus: 'source_inconnue' }
  }
  const lecture = MessagePage.safeParse(evenement.data)
  if (!lecture.success) return { accepte: false, refus: 'schema' }
  // Avant `etat.init`, la fiche ne connaît que son manifeste embarqué : son `page.prete` porte donc
  // le bloc de ce manifeste (la fiche de démonstration sert tous les blocs).
  if (lecture.data.type !== 'page.prete' && lecture.data.bloc !== contexte.bloc)
    return { accepte: false, refus: 'bloc' }
  if (lecture.data.version !== contexte.version) return { accepte: false, refus: 'version' }
  return { accepte: true, message: lecture.data }
}
