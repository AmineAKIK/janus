import type { Periode } from '@janus/contrats'
import type { FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceSuivi } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurSuivi(service: ServiceSuivi) {
  return {
    tableauDeBord: (
      requete: FastifyRequest<{ Querystring: { module?: string; periode?: Periode } }>,
    ) => service.tableauDeBord(utilisateurDe(requete), requete.query),
  }
}
export type ControleurSuivi = ReturnType<typeof creerControleurSuivi>
