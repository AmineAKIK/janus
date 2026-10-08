import type { FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceRevisions } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurRevisions(service: ServiceRevisions) {
  return {
    questionsDebut: (requete: FastifyRequest) => service.questionsDebut(utilisateurDe(requete)),
  }
}
export type ControleurRevisions = ReturnType<typeof creerControleurRevisions>
