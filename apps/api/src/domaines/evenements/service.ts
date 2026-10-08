import { Manifeste, Reglages, nouvelId } from '@janus/contrats'
import type { StatutBloc } from '@janus/contrats'
import { calculerBloc, instantEnMs } from '@janus/moteur'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import { verrouBloc } from '../../base/transaction.ts'
import { ConflitEtatPage, ContenuDifferent, ErreurProtocole, Introuvable } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import { recalculer, versStatutBloc } from '../../recalcul.ts'
import type { DepotEvenements } from './depot.ts'
import {
  MESSAGES_AILLEURS,
  decisionsDuBilan,
  empreinteDuMessage,
  enregistrementDe,
} from './policy.ts'
import type { Message } from './policy.ts'

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotEvenements
  readonly horloge: Horloge
}

export interface ResultatEvenement {
  readonly doublon: boolean
  readonly statut: StatutBloc | null
}

function introuvable(quoi: string): Introuvable {
  return new Introuvable(`${quoi} n'existe pas.`)
}

export function creerServiceEvenements({ base, depot, horloge }: DependancesService) {
  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

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
      const enregistrement = enregistrementDe(message)

      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, bloc.id)
        const maintenant = horloge.maintenant()
        const existant = await depot.evenementParId(tx, message.id)
        if (existant !== undefined) {
          if (existant.userId !== userId || existant.empreinte !== empreinte) {
            throw new ContenuDifferent('Cet identifiant a déjà servi pour un autre contenu.')
          }
          return { doublon: true, statut: null }
        }
        await depot.ajouterEvenement(tx, {
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
        if (message.type === 'bilan.erreurs') {
          const faits = await lireFaits(tx, userId, [bloc])
          const ouvertes = calculerBloc(faits, manifeste, reglages, maintenant).erreursOuvertes
          const { aCocher, aDecocher } = decisionsDuBilan(ouvertes, message.ids)
          await depot.ajouterDecisions(
            tx,
            [
              ...aCocher.map((erreurId) => ({ erreurId, decision: 'cochee' as const })),
              ...aDecocher.map((erreurId) => ({ erreurId, decision: 'decochee' as const })),
            ].map(({ erreurId, decision }) => ({
              id: identifiant(),
              userId,
              blocId: bloc.id,
              erreurId,
              decision,
              source: 'amine' as const,
              dateServeur: maintenant,
            })),
          )
        }
        if (!enregistrement.changeLeStatut) return { doublon: false, statut: null }
        const resultat = await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant })
        return { doublon: false, statut: versStatutBloc(resultat) }
      })
    },

    /** Écrit l'état d'une page si l'onglet a lu la bonne version, sinon rend l'état actuel (409). */
    async sauverEtat(userId: string, code: string, demande: { version: number; etat: unknown }) {
      const bloc = await depot.blocParCode(base.db, code)
      if (bloc === undefined) throw introuvable(`Le bloc « ${code} »`)
      const maintenant = horloge.maintenant()
      const version = await depot.ecrireEtat(base.db, {
        userId,
        blocId: bloc.id,
        version: demande.version,
        etat: demande.etat,
        maintenant,
      })
      if (version !== undefined) return { version }
      const actuel = await depot.etatActuel(base.db, userId, bloc.id)
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
