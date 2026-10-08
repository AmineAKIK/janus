import type { FastifyReply } from 'fastify'
import type { ServiceSante } from './service.ts'

export function creerControleurSante(service: ServiceSante) {
  return {
    sante: async (_requete: unknown, reponse: FastifyReply) => {
      const etat = await service.etat()
      return reponse.code(etat.ok ? 200 : 503).send(etat)
    },
  }
}

export type ControleurSante = ReturnType<typeof creerControleurSante>
