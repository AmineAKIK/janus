import type { ModificationReglages } from '@janus/contrats'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ServiceReglages } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

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
