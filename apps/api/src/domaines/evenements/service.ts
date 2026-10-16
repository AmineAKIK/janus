import { Manifeste, Reglages, memeContenu, nouvelId } from '@janus/contrats'
import type { Statut, StatutBloc } from '@janus/contrats'
import { calculerBloc, instantEnMs, statutDuBloc } from '@janus/moteur'
import { maintenantDuBloc, sousVerrouDuBloc } from '../../base/axeTemps.ts'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import { ConflitEtatPage, ContenuDifferent, ErreurProtocole, introuvable } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import { recalculer } from '../../recalcul.ts'
import type { DepotEvenements, StatutForce } from './depot.ts'
import {
  MESSAGES_AILLEURS,
  decisionsDuBilan,
  empreinteDuMessage,
  erreurProposee,
  enregistrementDe,
  estSansEffet,
  incoherence,
} from './policy.ts'
import type { Message } from './policy.ts'

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotEvenements
  readonly horloge: Horloge
}

export type DemandeForce =
  { id: string; action: 'forcer'; statut: Statut; raison: string } | { id: string; action: 'lever' }

export interface DemandeErreur {
  id: string
  erreur: string
  correction: string
  decision: 'confirmee' | 'rejetee'
}

export interface ResultatEvenement {
  readonly doublon: boolean
  readonly statut: StatutBloc | null
}

export function creerServiceEvenements({ base, depot, horloge }: DependancesService) {
  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

  /** Le bloc de ce code (dans sa version en service), son manifeste et les réglages de l'utilisateur. */
  async function contexteDuBloc(userId: string, code: string) {
    const trouve = await depot.blocEtVersions(base.db, code, undefined)
    if (trouve === undefined) throw introuvable(`Le bloc « ${code} »`)
    const manifeste = Manifeste.parse(trouve.manifeste)
    const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
    return { bloc: trouve.bloc, manifeste, reglages }
  }

  return {
    /**
     * Enregistre un message de la page. Le verrou du bloc fait passer les écritures d'un même bloc
     * l'une après l'autre ; le même identifiant avec le même contenu est un doublon, sans effet.
     */
    async enregistrer(userId: string, message: Message): Promise<ResultatEvenement> {
      const ailleurs = MESSAGES_AILLEURS[message.type]
      if (ailleurs !== undefined) {
        throw new ErreurProtocole(
          400,
          'donnees_invalides',
          'Mauvaise route',
          `Ce message passe par ${ailleurs}.`,
        )
      }
      const empreinte = empreinteDuMessage(message)
      const version = 'version' in message ? message.version : undefined
      const trouve = await depot.blocEtVersions(base.db, message.bloc, version)
      if (trouve?.versionDemandee === undefined) {
        throw introuvable(
          `Le bloc « ${message.bloc} »${version === undefined ? '' : ` en version ${String(version)}`}`,
        )
      }
      const { bloc, versionDemandee } = trouve
      const manifeste = Manifeste.parse(trouve.manifeste)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const inconnu = incoherence(message, manifeste)
      if (inconnu !== undefined) {
        throw new ErreurProtocole(
          400,
          'donnees_invalides',
          'Message incohérent avec la fiche',
          `Ce bloc, en version ${versionDemandee}, ne connaît pas ${inconnu}.`,
        )
      }
      if (estSansEffet(message)) return { doublon: false, statut: null }
      const enregistrement = enregistrementDe(message)

      return base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        // Le doublon rend le statut que la première réception a rendu (il se recalcule à l'identique).
        const doublon = async (existant: { userId: string; empreinte: string }) => {
          if (existant.userId !== userId || existant.empreinte !== empreinte) {
            throw new ContenuDifferent()
          }
          if (!enregistrement.changeLeStatut) return { doublon: true, statut: null }
          const actuel = await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant })
          return { doublon: true, statut: statutDuBloc(actuel) }
        }
        const existant = await depot.evenementParId(tx, message.id)
        if (existant !== undefined) return doublon(existant)
        const ajoute = await depot.ajouterEvenement(tx, {
          id: message.id,
          userId,
          blocId: bloc.id,
          ficheVersionId: versionDemandee,
          type: enregistrement.type,
          donnees: enregistrement.donnees,
          empreinte,
          aide: enregistrement.aide,
          dateServeur: maintenant,
        })
        if (!ajoute) {
          // Un autre bloc a pris l'identifiant entre la lecture et l'écriture.
          const concurrent = await depot.evenementParId(tx, message.id)
          if (concurrent !== undefined) return doublon(concurrent)
        }
        if (message.type === 'bilan.erreurs') {
          const faits = await lireFaits(tx, userId, [bloc])
          const ouvertes = calculerBloc(faits, manifeste, reglages, maintenant).erreursOuvertes
          const { aCocher } = decisionsDuBilan(ouvertes, message.ids)
          await depot.ajouterDecisions(
            tx,
            aCocher.map((erreurId) => ({
              id: identifiant(),
              userId,
              blocId: bloc.id,
              erreurId,
              decision: 'cochee' as const,
              source: 'amine' as const,
              correctionId: null,
              dateServeur: maintenant,
            })),
          )
        }
        if (!enregistrement.changeLeStatut) return { doublon: false, statut: null }
        const resultat = await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant })
        return { doublon: false, statut: statutDuBloc(resultat) }
      })
    },

    /**
     * Force un statut (avec sa raison) ou lève la force. Le fait est ajouté, jamais modifié : le
     * même identifiant avec le même contenu est un doublon, avec un autre contenu c'est 422.
     */
    async forcer(userId: string, code: string, demande: DemandeForce) {
      const { bloc, manifeste, reglages } = await contexteDuBloc(userId, code)
      const voulu: Pick<StatutForce, 'action' | 'statut' | 'raison'> =
        demande.action === 'forcer'
          ? { action: 'forcer', statut: demande.statut, raison: demande.raison }
          : { action: 'lever', statut: null, raison: null }
      return base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        const existant = await depot.forceParId(tx, demande.id)
        if (existant === undefined) {
          await depot.ajouterForce(tx, {
            id: demande.id,
            userId,
            blocId: bloc.id,
            ...voulu,
            dateServeur: maintenant,
          })
        } else if (
          existant.userId !== userId ||
          existant.blocId !== bloc.id ||
          existant.action !== voulu.action ||
          existant.statut !== voulu.statut ||
          existant.raison !== voulu.raison
        ) {
          throw new ContenuDifferent()
        }
        const resultat = await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant })
        return {
          ...statutDuBloc(resultat),
          force: resultat.force,
          statut_calcule: resultat.statutCalcule,
        }
      })
    },

    /** Amine tranche une erreur critique que l'IA a repérée : confirmée (elle s'ouvre) ou rejetée. */
    async trancherErreur(userId: string, code: string, demande: DemandeErreur) {
      const { bloc, manifeste, reglages } = await contexteDuBloc(userId, code)
      return base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        const existant = await depot.decisionParId(tx, demande.id)
        if (existant === undefined) {
          const correction = await depot.correctionParId(tx, userId, demande.correction)
          if (correction?.blocId !== bloc.id) {
            throw introuvable(`La correction « ${demande.correction} »`)
          }
          if (!erreurProposee(correction.erreursIds, demande.erreur)) {
            throw new ErreurProtocole(
              400,
              'donnees_invalides',
              'Erreur inconnue',
              'Cette correction n’a pas repéré cette erreur.',
            )
          }
          await depot.ajouterDecisions(tx, [
            {
              id: demande.id,
              userId,
              blocId: bloc.id,
              erreurId: demande.erreur,
              decision: demande.decision,
              source: null,
              correctionId: demande.correction,
              dateServeur: maintenant,
            },
          ])
        } else if (
          existant.userId !== userId ||
          existant.blocId !== bloc.id ||
          existant.erreurId !== demande.erreur ||
          existant.decision !== demande.decision ||
          existant.correctionId !== demande.correction
        ) {
          throw new ContenuDifferent()
        }
        return statutDuBloc(await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant }))
      })
    },

    /** Écrit l'état d'une page si l'onglet a lu la bonne version, sinon rend l'état actuel (409). */
    async sauverEtat(userId: string, code: string, demande: { version: number; etat: unknown }) {
      const bloc = await depot.blocParCode(base.db, code)
      if (bloc === undefined) throw introuvable(`Le bloc « ${code} »`)
      const maintenant = await maintenantDuBloc(base.db, horloge, userId, bloc.id)
      const version = await depot.ecrireEtat(base.db, {
        userId,
        blocId: bloc.id,
        version: demande.version,
        etat: demande.etat,
        maintenant,
      })
      if (version !== undefined) return { version }
      const actuel = await depot.etatActuel(base.db, userId, bloc.id)
      // Rejeu après une réponse perdue : l'écriture a eu lieu, l'état est celui qu'on envoie.
      if (
        actuel !== undefined &&
        actuel.version === demande.version + 1 &&
        memeContenu(actuel.etat, demande.etat)
      ) {
        return { version: actuel.version }
      }
      if (actuel === undefined) {
        // Version lue > 0 mais aucun état : l'onglet vient d'ailleurs, il repart de zéro.
        throw new ConflitEtatPage({ version: 0, etat: {}, modifie_le: maintenant })
      }
      throw new ConflitEtatPage({
        version: actuel.version,
        etat: actuel.etat,
        modifie_le: actuel.modifieLe,
      })
    },
  }
}
export type ServiceEvenements = ReturnType<typeof creerServiceEvenements>
