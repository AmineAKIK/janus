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
    ajouterNote: async (
      requete: FastifyRequest<{ Body: { id: string; entree: string; texte: string } }>,
      reponse: FastifyReply,
    ) => reponse.code(201).send(await service.ajouterNote(utilisateurDe(requete), requete.body)),
    modifierNote: (requete: FastifyRequest<{ Params: { id: string }; Body: { texte: string } }>) =>
      service.modifierNote(utilisateurDe(requete), requete.params.id, requete.body.texte),
    ajouterIdee: async (
      requete: FastifyRequest<{ Body: { id: string; texte: string } }>,
      reponse: FastifyReply,
    ) => reponse.code(201).send(await service.ajouterIdee(utilisateurDe(requete), requete.body)),
    ajouterRevue: async (
      requete: FastifyRequest<{ Body: { id: string; texte?: string } }>,
      reponse: FastifyReply,
    ) => {
      await service.ajouterRevue(utilisateurDe(requete), requete.body)
      return reponse.code(204).send()
    },
    tableauDeBord: (
      requete: FastifyRequest<{ Querystring: { module?: string; periode?: Periode } }>,
    ) => service.tableauDeBord(utilisateurDe(requete), requete.query),
  }
}
export type ControleurSuivi = ReturnType<typeof creerControleurSuivi>
