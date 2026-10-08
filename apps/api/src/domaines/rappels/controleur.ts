import type { FastifyReply, FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceRappels } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

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
