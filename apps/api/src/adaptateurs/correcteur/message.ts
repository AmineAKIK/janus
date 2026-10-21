import { readFileSync } from 'node:fs'
import { sha256Hex } from '../../base/empreinte.ts'
import type { RequeteCorrection } from './correcteur.ts'

/**
 * La consigne fixe : `prompts/correction/<version>.md`, lue une fois, avec son empreinte gardée à chaque
 * correction. Les versions précédentes restent dans le dossier : l'empreinte d'une ancienne correction s'y retrouve.
 */
export const VERSION_CONSIGNE = 'v3'
const FICHIER_CONSIGNE = new URL(
  `../../../../../prompts/correction/${VERSION_CONSIGNE}.md`,
  import.meta.url,
)
export const CONSIGNE = readFileSync(FICHIER_CONSIGNE, 'utf8')
export const EMPREINTE_CONSIGNE = sha256Hex(CONSIGNE)

const REPONSE_MAX = 2000
export const RAPPEL_JSON = 'Réponds uniquement avec le JSON demandé.'

export interface MessageChat {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** Le contexte du bloc : titre, cours, sources, erreurs critiques. Identique d'une réponse à l'autre du même bloc. */
export function contexteDuBloc(requete: RequeteCorrection): string {
  return [
    `Bloc : ${requete.titre}`,
    'Cours du bloc :',
    requete.contexteIa,
    `Sources : ${requete.sources.map(({ id, ref }) => `${id} : ${ref}`).join('\n')}`,
    `Erreurs critiques de ce bloc : ${requete.erreursCritiques
      .map(({ id, texte }) => `${id} : ${texte}`)
      .join('\n')}`,
  ].join('\n')
}

/** La question, l'attendu, la confiance et la réponse entre délimiteurs : la part qui change à chaque appel. */
export function questionEtReponse(requete: RequeteCorrection, reponse: string): string {
  return [
    '',
    `Question : ${requete.question}`,
    `Attendu (appui, pas barème) : ${requete.attendu}`,
    `Confiance annoncée : ${requete.confiance}`,
    '<reponse>',
    reponse.slice(0, REPONSE_MAX),
    '</reponse>',
  ].join('\n')
}

/** Le message utilisateur du cadrage : le contexte du bloc, puis la question et la réponse. */
function messageUtilisateur(requete: RequeteCorrection, reponse: string): string {
  return `${contexteDuBloc(requete)}\n${questionEtReponse(requete, reponse)}`
}

/**
 * L'ordre des messages : la consigne, puis le message du premier tour (contexte, question, réponse),
 * puis pour une relance chaque réponse de l'apprenant et la réponse du tuteur, la dernière réponse
 * de l'apprenant à la fin.
 */
export function messagesDeLaRequete(requete: RequeteCorrection): MessageChat[] {
  const [premier, ...suite] = requete.historique
  const messages: MessageChat[] = [{ role: 'system', content: CONSIGNE }]
  if (premier === undefined) {
    messages.push({ role: 'user', content: messageUtilisateur(requete, requete.reponse) })
  } else {
    messages.push({ role: 'user', content: messageUtilisateur(requete, premier.reponse) })
    messages.push({ role: 'assistant', content: premier.message })
    for (const tour of suite) {
      messages.push({
        role: 'user',
        content: `<reponse>\n${tour.reponse.slice(0, REPONSE_MAX)}\n</reponse>`,
      })
      messages.push({ role: 'assistant', content: tour.message })
    }
    messages.push({
      role: 'user',
      content: `<reponse>\n${requete.reponse.slice(0, REPONSE_MAX)}\n</reponse>`,
    })
  }
  if (requete.strict) messages.push({ role: 'user', content: RAPPEL_JSON })
  return messages
}
