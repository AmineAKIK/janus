import type { NoteCarte } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceRevisions } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurRevisions(service: ServiceRevisions) {
  return {
    questionsDebut: (requete: FastifyRequest) => service.questionsDebut(utilisateurDe(requete)),
    cartesDues: (requete: FastifyRequest) => service.cartesDues(utilisateurDe(requete)),
    verification: (requete: FastifyRequest<{ Params: { id: string } }>) =>
      service.verification(utilisateurDe(requete), requete.params.id),
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
