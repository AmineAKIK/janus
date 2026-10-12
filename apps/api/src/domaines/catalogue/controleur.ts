import type { ROUTES } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { ServiceLecture } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

type Params = { Params: { id: string } }
type CorpsOuvrir = z.infer<(typeof ROUTES)['POST /blocs/:id/ouvrir']['corps']>

export function creerControleurCatalogue(service: ServiceLecture) {
  return {
    formations: (requete: FastifyRequest) => service.formations(utilisateurDe(requete)),
    modules: (requete: FastifyRequest<Params>) => service.modules(requete.params.id),
    blocsDuModule: (requete: FastifyRequest<Params>) =>
      service.blocsDuModule(utilisateurDe(requete), requete.params.id),
    bloc: (requete: FastifyRequest<Params>) =>
      service.bloc(utilisateurDe(requete), requete.params.id),
    ouvrir: (requete: FastifyRequest<Params & { Body: CorpsOuvrir }>) =>
      service.ouvrir(utilisateurDe(requete), requete.params.id, requete.body),
  }
}
export type ControleurCatalogue = ReturnType<typeof creerControleurCatalogue>
