import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { RequeteCorrection } from './correcteur.ts'

/** La consigne fixe : `prompts/correction/v1.md`, lue une fois, avec son empreinte gardée à chaque correction. */
const FICHIER_CONSIGNE = new URL('../../../../../prompts/correction/v1.md', import.meta.url)
export const CONSIGNE = readFileSync(FICHIER_CONSIGNE, 'utf8')
export const EMPREINTE_CONSIGNE = createHash('sha256').update(CONSIGNE).digest('hex')

export const REPONSE_MAX = 2000
export const RAPPEL_JSON = 'Réponds uniquement avec le JSON demandé.'

export interface MessageChat {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** Le message utilisateur du cadrage : le cours, la question, l'attendu, la réponse entre délimiteurs. */
export function messageUtilisateur(requete: RequeteCorrection, reponse: string): string {
  return [
    `Bloc : ${requete.titre}`,
    'Cours du bloc :',
    requete.contexteIa,
    `Sources : ${requete.sources.map(({ id, ref }) => `${id} : ${ref}`).join('\n')}`,
    `Erreurs critiques de ce bloc : ${requete.erreursCritiques
      .map(({ id, texte }) => `${id} : ${texte}`)
      .join('\n')}`,
    '',
    `Question : ${requete.question}`,
    `Attendu (appui, pas barème) : ${requete.attendu}`,
    `Confiance annoncée : ${requete.confiance}`,
    '<reponse>',
    reponse.slice(0, REPONSE_MAX),
    '</reponse>',
  ].join('\n')
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
