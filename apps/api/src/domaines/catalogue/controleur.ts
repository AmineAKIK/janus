import type { ROUTES } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceLecture } from './service.ts'

type Params = { Params: { id: string } }
type CorpsOuvrir = z.infer<(typeof ROUTES)['POST /blocs/:id/ouvrir']['corps']>

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurCatalogue(service: ServiceLecture) {
  return {
    formations: () => service.formations(),
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
