import type { ROUTES } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceCorrection } from './service.ts'

type CorpsCorrection = z.infer<(typeof ROUTES)['POST /corrections']['corps']>

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurCorrection(service: ServiceCorrection) {
  return {
    corriger: (requete: FastifyRequest<{ Body: CorpsCorrection }>) =>
      service.corriger(utilisateurDe(requete), requete.body),
  }
}
export type ControleurCorrection = ReturnType<typeof creerControleurCorrection>
