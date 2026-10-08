import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ErreurMetier, Introuvable, TropDeTentatives, versProbleme } from '../erreurs.ts'
import type { Dependances } from '../types.ts'

const TYPE_PROBLEME = 'application/problem+json'

function envoyer(
  reponse: FastifyReply,
  [status, code, titre, detail, extras]: Parameters<typeof versProbleme>,
): FastifyReply {
  return reponse
    .code(status)
    .type(TYPE_PROBLEME)
    .send(versProbleme(status, code, titre, detail, extras))
}

function aUnStatut(
  erreur: unknown,
): erreur is { statusCode: number; code?: string; message: string } {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'statusCode' in erreur &&
    typeof erreur.statusCode === 'number' &&
    'message' in erreur &&
    typeof erreur.message === 'string'
  )
}

/** Le seul endroit qui traduit une erreur en réponse : `application/problem+json`, sans détail interne en 500. */
export function gestionnaireErreurs(app: FastifyInstance, { observer }: Dependances): void {
  app.setNotFoundHandler(() => {
    throw new Introuvable('Cette adresse n’existe pas.')
  })
  app.setErrorHandler((erreur: FastifyError | Error, requete: FastifyRequest, reponse) => {
    observer?.('gestionnaire_erreurs')
    if (erreur instanceof ErreurMetier) {
      if (erreur instanceof TropDeTentatives) {
        void reponse.header('retry-after', String(erreur.reessayerDansS))
      }
      return envoyer(reponse, [
        erreur.status,
        erreur.code,
        erreur.titre,
        erreur.message,
        erreur.extras,
      ])
    }
    if (hasZodFastifySchemaValidationErrors(erreur)) {
      const detail = erreur.validation
        .map(
          ({ instancePath, message }) =>
            `${instancePath === '' ? '/' : instancePath} : ${message ?? 'invalide'}`,
        )
        .join(' ; ')
      return envoyer(reponse, [400, 'donnees_invalides', 'Données invalides', detail])
    }
    if (aUnStatut(erreur)) {
      if (erreur.statusCode === 429) {
        return envoyer(reponse, [
          429,
          'trop_de_requetes',
          'Trop de requêtes',
          'Trop de requêtes : réessaie dans un instant.',
        ])
      }
      if (erreur.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        return envoyer(reponse, [
          413,
          'donnees_invalides',
          'Corps trop gros',
          'Le corps de la requête est trop gros.',
        ])
      }
      if (erreur.code === 'FST_ERR_HANDLER_TIMEOUT') {
        return envoyer(reponse, [
          503,
          'delai_depasse',
          'Délai dépassé',
          'Le serveur a mis trop de temps à répondre.',
        ])
      }
      if (erreur.statusCode >= 400 && erreur.statusCode < 500) {
        return envoyer(reponse, [
          erreur.statusCode,
          'donnees_invalides',
          'Requête invalide',
          erreur.message,
        ])
      }
    }
    // Inattendue : aucun détail dans la réponse, la pile dans le journal.
    requete.log.error({ err: erreur }, 'erreur inattendue')
    return envoyer(reponse, [500, 'erreur_interne', 'Erreur interne', 'Une erreur est survenue.'])
  })
}
