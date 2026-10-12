import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ServiceRappels } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

export function creerControleurRappels(service: ServiceRappels) {
  return {
    abonner: async (
      requete: FastifyRequest<{
        Body: { id: string; endpoint: string; cles: { p256dh: string; auth: string } }
      }>,
      reponse: FastifyReply,
    ) => reponse.code(201).send(await service.abonner(utilisateurDe(requete), requete.body)),
    desabonner: async (
      requete: FastifyRequest<{ Params: { id: string } }>,
      reponse: FastifyReply,
    ) => {
      await service.desabonner(utilisateurDe(requete), requete.params.id)
      return reponse.code(204).send()
    },
  }
}
export type ControleurRappels = ReturnType<typeof creerControleurRappels>
