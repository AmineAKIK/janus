import type { ROUTES } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { ServiceEvenements } from './service.ts'
import { utilisateurDe } from '../../plugins/contrat.ts'

type CorpsEvenement = z.infer<(typeof ROUTES)['POST /evenements']['corps']>
type CorpsForcer = z.infer<(typeof ROUTES)['POST /blocs/:id/forcer']['corps']>
type CorpsErreur = z.infer<(typeof ROUTES)['POST /blocs/:id/erreurs']['corps']>
type CorpsEtat = z.infer<(typeof ROUTES)['PUT /blocs/:id/etat-page']['corps']>

export function creerControleurEvenements(service: ServiceEvenements) {
  return {
    evenement: (requete: FastifyRequest<{ Body: CorpsEvenement }>) =>
      service.enregistrer(utilisateurDe(requete), requete.body),
    forcer: (requete: FastifyRequest<{ Params: { id: string }; Body: CorpsForcer }>) =>
      service.forcer(utilisateurDe(requete), requete.params.id, requete.body),
    erreur: (requete: FastifyRequest<{ Params: { id: string }; Body: CorpsErreur }>) =>
      service.trancherErreur(utilisateurDe(requete), requete.params.id, requete.body),
    etatPage: (requete: FastifyRequest<{ Params: { id: string }; Body: CorpsEtat }>) =>
      service.sauverEtat(utilisateurDe(requete), requete.params.id, requete.body),
  }
}
export type ControleurEvenements = ReturnType<typeof creerControleurEvenements>
