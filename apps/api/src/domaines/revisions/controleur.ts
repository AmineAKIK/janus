import type { NoteCarte, TypeVerification } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import type { ServiceRevisions } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

export function creerControleurRevisions(service: ServiceRevisions) {
  return {
    questionsDebut: (requete: FastifyRequest) => service.questionsDebut(utilisateurDe(requete)),
    garderQuestionsDebut: (requete: FastifyRequest) =>
      service.garderQuestionsDebut(utilisateurDe(requete)),
    ouvrirVerification: (
      requete: FastifyRequest<{ Body: { bloc: string; type: TypeVerification } }>,
    ) =>
      service
        .verificationPour(utilisateurDe(requete), requete.body.bloc, requete.body.type)
        .then((id) => ({ id })),
    aujourdhui: (requete: FastifyRequest) =>
      service.aujourdhui(utilisateurDe(requete), requete.signal),
    cartesDues: (requete: FastifyRequest) =>
      service.cartesDues(utilisateurDe(requete), requete.signal),
    verification: (requete: FastifyRequest<{ Params: { id: string } }>) =>
      service.verification(utilisateurDe(requete), requete.params.id),
    repondre: (
      requete: FastifyRequest<{
        Params: { id: string }
        Body: Parameters<ServiceRevisions['repondre']>[2]
      }>,
    ) => service.repondre(utilisateurDe(requete), requete.params.id, requete.body),
    reporterVerification: (
      requete: FastifyRequest<{ Params: { id: string }; Body: { id: string } }>,
    ) => service.reporterVerification(utilisateurDe(requete), requete.params.id, requete.body.id),
    noterCarte: (
      requete: FastifyRequest<{
        Params: { id: string }
        Body: { id: string; note: NoteCarte }
      }>,
    ) =>
      service.noterCarte(
        utilisateurDe(requete),
        requete.params.id,
        requete.body.id,
        requete.body.note,
      ),
  }
}
export type ControleurRevisions = ReturnType<typeof creerControleurRevisions>
