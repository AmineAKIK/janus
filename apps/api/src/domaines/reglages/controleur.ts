import type { ModificationReglages } from '@janus/contrats'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceReglages } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurReglages(service: ServiceReglages) {
  return {
    lire: async (requete: FastifyRequest, reponse: FastifyReply) => {
      const { reglages, etag } = await service.lire(utilisateurDe(requete))
      void reponse.header('etag', etag)
      return reglages
    },
    modifier: async (
      requete: FastifyRequest<{ Body: ModificationReglages }>,
      reponse: FastifyReply,
    ) => {
      const { reglages, etag } = await service.modifier(
        utilisateurDe(requete),
        requete.headers['if-match'],
        requete.body,
      )
      void reponse.header('etag', etag)
      return reglages
    },
  }
}
export type ControleurReglages = ReturnType<typeof creerControleurReglages>
