import { nouvelId, Reglages } from '@janus/contrats'
import type { Moi } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import { Introuvable, NonAuthentifie, Refus, TropDeTentatives } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import type { ResoudreSession, Session } from '../../types.ts'
import { appareilDepuis, empreinteDuJeton, nouveauJeton } from './adaptateur.ts'
import type { Hacheur } from './adaptateur.ts'
import type { DepotAuth, Utilisateur } from './depot.ts'
import {
  DUREE_PERSISTANTE_JOURS,
  OCTETS_MAX,
  activiteAReecrire,
  creerLimiteur,
  octets,
  sessionActive,
} from './policy.ts'

const SECONDES_PAR_JOUR = 86_400
const MESSAGE_CONNEXION = 'Identifiant ou mot de passe incorrect.'
const SESSION_VIDE: Session = { utilisateur: null, sessionId: null }

export interface Connexion {
  readonly nomUtilisateur: string
  readonly motDePasse: string
  readonly resterConnecte: boolean
  readonly adresse: string
  readonly userAgent: string | undefined
}

export interface SessionOuverte {
  readonly moi: Moi
  readonly jeton: string
  /** La durée du cookie en secondes ; `null` pour un cookie de session. */
  readonly dureeCookieS: number | null
}

export interface SessionAffichee {
  readonly id: string
  readonly appareil: string
  readonly creeeLe: string
  readonly derniereActivite: string
  readonly courante: boolean
}

export interface DependancesService {
  readonly depot: DepotAuth
  readonly hacheur: Hacheur
  readonly horloge: Horloge
}

function moiDe(utilisateur: Utilisateur): Moi {
  return {
    id: utilisateur.id,
    nom_utilisateur: utilisateur.nomUtilisateur,
    fuseau: Reglages.parse(utilisateur.reglages).fuseau,
  }
}

export function creerServiceAuth({ depot, hacheur, horloge }: DependancesService) {
  const limiteur = creerLimiteur()

  /** Vrai si le mot de passe correspond ; un mot de passe trop long ne correspond jamais (bcrypt le tronquerait). */
  async function verifier(motDePasse: string, utilisateur: Utilisateur | undefined) {
    if (utilisateur === undefined || octets(motDePasse) > OCTETS_MAX) {
      return hacheur.comparerFactice(motDePasse)
    }
    return hacheur.comparer(motDePasse, utilisateur.motDePasseHash)
  }

  async function utilisateurConnecte(userId: string): Promise<Utilisateur> {
    const utilisateur = await depot.utilisateur(userId)
    if (utilisateur === undefined) throw new NonAuthentifie('Connecte-toi pour continuer.')
    return utilisateur
  }

  return {
    /** Ouvre une session : le même refus quel que soit le champ faux, et la même lenteur. */
    async connecter(connexion: Connexion): Promise<SessionOuverte> {
      const maintenant = horloge.maintenant()
      const essai = limiteur.tenter(
        `${connexion.adresse}|${connexion.nomUtilisateur.toLowerCase()}`,
        maintenant,
      )
      if (!essai.autorise) throw new TropDeTentatives(essai.reessayerDansS)
      const utilisateur = await depot.utilisateurParNom(connexion.nomUtilisateur)
      const correspond = await verifier(connexion.motDePasse, utilisateur)
      if (utilisateur === undefined || !correspond) throw new NonAuthentifie(MESSAGE_CONNEXION)
      const jeton = nouveauJeton()
      await depot.creerSession({
        id: nouvelId(instantEnMs(maintenant)),
        userId: utilisateur.id,
        empreinteJeton: empreinteDuJeton(jeton),
        creeLe: maintenant,
        appareil: appareilDepuis(connexion.userAgent),
        persistante: connexion.resterConnecte,
        dureeJours: DUREE_PERSISTANTE_JOURS,
      })
      return {
        moi: moiDe(utilisateur),
        jeton,
        dureeCookieS: connexion.resterConnecte ? DUREE_PERSISTANTE_JOURS * SECONDES_PAR_JOUR : null,
      }
    },

    /** La session que désigne le jeton du cookie ; vide si elle est inconnue, révoquée ou expirée. */
    resoudre: (async (jeton) => {
      if (jeton === undefined || jeton === '') return SESSION_VIDE
      const session = await depot.sessionParEmpreinte(empreinteDuJeton(jeton))
      const maintenant = horloge.maintenant()
      if (session === undefined || !sessionActive(session, maintenant)) return SESSION_VIDE
      if (activiteAReecrire(session, maintenant)) await depot.toucher(session.id, maintenant)
      return { utilisateur: session.userId, sessionId: session.id }
    }) satisfies ResoudreSession,

    async deconnecter(sessionId: string | null): Promise<void> {
      if (sessionId !== null) await depot.revoquer(sessionId, horloge.maintenant())
    },

    async moi(userId: string): Promise<Moi> {
      return moiDe(await utilisateurConnecte(userId))
    },

    async sessions(userId: string, courante: string | null): Promise<SessionAffichee[]> {
      const maintenant = horloge.maintenant()
      const stockees = await depot.sessionsDe(userId)
      return stockees
        .filter((session) => sessionActive(session, maintenant))
        .map((session) => ({
          id: session.id,
          appareil: session.appareil ?? 'Appareil inconnu',
          creeeLe: session.creeLe,
          derniereActivite: session.derniereActivite,
          courante: session.id === courante,
        }))
    },

    async revoquer(userId: string, id: string): Promise<void> {
      if ((await depot.sessionDe(userId, id)) === undefined) {
        throw new Introuvable('Cette session n’existe pas.')
      }
      await depot.revoquer(id, horloge.maintenant())
    },

    /** Change le mot de passe, puis déconnecte les autres appareils. */
    async changerMotDePasse(
      userId: string,
      sessionCourante: string | null,
      ancien: string,
      nouveau: string,
    ): Promise<void> {
      const utilisateur = await utilisateurConnecte(userId)
      if (!(await verifier(ancien, utilisateur)))
        throw new Refus('Le mot de passe actuel est incorrect.')
      await depot.changerMotDePasse(
        userId,
        await hacheur.hacher(nouveau),
        sessionCourante,
        horloge.maintenant(),
      )
    },

    /** Efface le compte et tout ce qui le concerne, mot de passe exigé. */
    async supprimerCompte(userId: string, motDePasse: string): Promise<void> {
      const utilisateur = await utilisateurConnecte(userId)
      if (!(await verifier(motDePasse, utilisateur)))
        throw new Refus('Le mot de passe est incorrect.')
      await depot.supprimerCompte(userId)
    },
  }
}
export type ServiceAuth = ReturnType<typeof creerServiceAuth>
