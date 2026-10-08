import type { Periode, TypeJournal } from '@janus/contrats'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { NonAuthentifie } from '../../erreurs.ts'
import type { ServiceSuivi } from './service.ts'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurSuivi(service: ServiceSuivi) {
  return {
    journal: (
      requete: FastifyRequest<{
        Querystring: { module?: string; bloc?: string; type?: TypeJournal; avant?: string }
      }>,
    ) => service.journal(utilisateurDe(requete), requete.query),
    exportTexte: async (requete: FastifyRequest, reponse: FastifyReply) => {
      const texte = await service.exportTexte(utilisateurDe(requete))
      return reponse.type('text/plain; charset=utf-8').send(texte)
    },
    tableauDeBord: (
      requete: FastifyRequest<{ Querystring: { module?: string; periode?: Periode } }>,
    ) => service.tableauDeBord(utilisateurDe(requete), requete.query),
  }
}
export type ControleurSuivi = ReturnType<typeof creerControleurSuivi>
