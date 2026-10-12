import type { ROUTES } from '@janus/contrats'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { ServiceCorrection } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

type CorpsAvis = z.infer<(typeof ROUTES)['POST /corrections/:id/accord']['corps']>
type CorpsTranchage = z.infer<(typeof ROUTES)['POST /corrections/:id/trancher']['corps']>
type CorpsCorrection = z.infer<(typeof ROUTES)['POST /corrections']['corps']>

export function creerControleurCorrection(service: ServiceCorrection) {
  return {
    corriger: (requete: FastifyRequest<{ Body: CorpsCorrection }>) =>
      service.corriger(utilisateurDe(requete), requete.body),
    accord: async (
      requete: FastifyRequest<{ Params: { id: string }; Body: CorpsAvis }>,
      reponse: FastifyReply,
    ) => {
      await service.donnerAvis(utilisateurDe(requete), requete.params.id, requete.body.accord)
      return reponse.code(204).send()
    },
    trancher: (requete: FastifyRequest<{ Params: { id: string }; Body: CorpsTranchage }>) =>
      service.trancher(utilisateurDe(requete), requete.params.id, requete.body),
  }
}
export type ControleurCorrection = ReturnType<typeof creerControleurCorrection>
