import type { CookieSerializeOptions } from '@fastify/cookie'
import { ROUTES } from '@janus/contrats'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { NonAuthentifie } from '../../erreurs.ts'
import type { Config } from '../../config.ts'
import type { ServiceAuth } from './service.ts'

type Corps<Cle extends 'POST /session' | 'PATCH /moi/mot-de-passe' | 'DELETE /compte'> = z.infer<
  (typeof ROUTES)[Cle]['corps']
>

export const NOM_COOKIE = 'janus_session'

function utilisateurDe(requete: FastifyRequest): string {
  const { utilisateur } = requete.session
  if (utilisateur === null) throw new NonAuthentifie('Connecte-toi pour continuer.')
  return utilisateur
}

export function creerControleurAuth(service: ServiceAuth, config: Pick<Config, 'COOKIE_SECURE'>) {
  const optionsCookie: CookieSerializeOptions = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  }

  return {
    connecter: async (
      requete: FastifyRequest<{ Body: Corps<'POST /session'> }>,
      reponse: FastifyReply,
    ) => {
      const ouverte = await service.connecter({
        nomUtilisateur: requete.body.nom_utilisateur,
        motDePasse: requete.body.mot_de_passe,
        resterConnecte: requete.body.rester_connecte ?? false,
        adresse: requete.ip,
        userAgent: requete.headers['user-agent'],
      })
      void reponse.setCookie(NOM_COOKIE, ouverte.jeton, {
        ...optionsCookie,
        ...(ouverte.dureeCookieS === null ? {} : { maxAge: ouverte.dureeCookieS }),
      })
      return ouverte.moi
    },

    deconnecter: async (requete: FastifyRequest, reponse: FastifyReply) => {
      await service.deconnecter(requete.session.sessionId)
      void reponse.clearCookie(NOM_COOKIE, optionsCookie)
      return reponse.code(204).send()
    },

    moi: (requete: FastifyRequest) => service.moi(utilisateurDe(requete)),

    sessions: async (requete: FastifyRequest) => {
      const sessions = await service.sessions(utilisateurDe(requete), requete.session.sessionId)
      return {
        sessions: sessions.map(({ creeeLe, derniereActivite, ...reste }) => ({
          ...reste,
          creee_le: creeeLe,
          derniere_activite: derniereActivite,
        })),
      }
    },

    revoquer: async (
      requete: FastifyRequest<{ Params: { id: string } }>,
      reponse: FastifyReply,
    ) => {
      await service.revoquer(utilisateurDe(requete), requete.params.id)
      return reponse.code(204).send()
    },

    changerMotDePasse: async (
      requete: FastifyRequest<{ Body: Corps<'PATCH /moi/mot-de-passe'> }>,
      reponse: FastifyReply,
    ) => {
      await service.changerMotDePasse(
        utilisateurDe(requete),
        requete.session.sessionId,
        requete.body.ancien,
        requete.body.nouveau,
      )
      return reponse.code(204).send()
    },

    supprimerCompte: async (
      requete: FastifyRequest<{ Body: Corps<'DELETE /compte'> }>,
      reponse: FastifyReply,
    ) => {
      await service.supprimerCompte(utilisateurDe(requete), requete.body.mot_de_passe)
      void reponse.clearCookie(NOM_COOKIE, optionsCookie)
      return reponse.code(204).send()
    },
  }
}
export type ControleurAuth = ReturnType<typeof creerControleurAuth>
