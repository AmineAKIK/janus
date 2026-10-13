import { nouvelId, Reglages } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import type { Base } from '../../base/base.ts'
import type { Envoyeur } from '../../adaptateurs/push/envoyeur.ts'
import { ContenuDifferent } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import type { BilanDesRappels, LireAujourdhui } from '../../types.ts'
import type { DepotRappels } from './depot.ts'
import { ceQuiEstDu, rappelAEnvoyer, texteDuRappel } from './policy.ts'

const TITRE = 'Janus'

/** Un message court pour le journal : jamais l'adresse de l'abonnement. */
function causeDeLEchec(cause: unknown): string {
  if (cause instanceof Error) {
    const statut = 'statusCode' in cause ? ` (${String(cause.statusCode)})` : ''
    return `${cause.name}${statut} : ${cause.message}`
  }
  return 'cause inconnue'
}

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotRappels
  readonly horloge: Horloge
  readonly envoyeur: Envoyeur
  readonly aujourdhui: LireAujourdhui
}

export function creerServiceRappels({
  base,
  depot,
  horloge,
  envoyeur,
  aujourdhui,
}: DependancesService) {
  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

  return {
    /** Enregistre l'abonnement push de cet appareil ; rejoué, il rend le même identifiant. */
    async abonner(
      userId: string,
      corps: { id: string; endpoint: string; cles: { p256dh: string; auth: string } },
    ) {
      const proprietaire = await depot.proprietaireDe(base.db, corps.id)
      if (proprietaire !== undefined && proprietaire !== userId) {
        throw new ContenuDifferent('Cet identifiant est déjà pris.')
      }
      const id = await base.enTransaction((tx) =>
        depot.ajouter(tx, {
          id: corps.id,
          userId,
          endpoint: corps.endpoint,
          p256dh: corps.cles.p256dh,
          auth: corps.cles.auth,
          creeLe: horloge.maintenant(),
        }),
      )
      return { id }
    },

    /** Retire l'abonnement de cet utilisateur ; sans effet s'il n'existe pas ou n'est pas à lui. */
    async desabonner(userId: string, id: string) {
      await depot.supprimer(base.db, id, userId)
    },

    /**
     * La tâche des rappels. Un rappel par utilisateur et par jour au plus : la ligne est insérée
     * avant l'envoi, donc une tâche lancée deux fois n'envoie qu'une notification.
     */
    async envoyerLesRappels(): Promise<BilanDesRappels> {
      const maintenant = horloge.maintenant()
      let rappels = 0
      let abonnementsSupprimes = 0
      let echecs = 0
      const causes: string[] = []
      for (const { id: userId, reglages: brut } of await depot.destinataires(base.db)) {
        const { aEnvoyer, jour } = rappelAEnvoyer(Reglages.parse(brut), maintenant)
        if (!aEnvoyer) continue
        const abonnements = await depot.abonnementsDe(base.db, userId)
        // Sans appareil abonné, le jour n'est pas consommé : un abonnement tardif reçoit encore le rappel.
        if (abonnements.length === 0) continue
        // Déjà réservé aujourd'hui : inutile de recalculer « aujourd'hui » (coûteux) à chaque passage.
        if (await depot.dejaReserve(base.db, userId, jour)) continue
        const corps = texteDuRappel(ceQuiEstDu(await aujourdhui(userId)))
        if (corps === null) continue
        const reserve = await depot.reserver(base.db, {
          id: identifiant(),
          userId,
          jour,
          envoyeLe: maintenant,
        })
        if (!reserve) continue
        let atteints = 0
        let echecsDeLUtilisateur = 0
        for (const abonnement of abonnements) {
          try {
            const issue = await envoyeur.envoyer(
              {
                endpoint: abonnement.endpoint,
                cles: { p256dh: abonnement.p256dh, auth: abonnement.auth },
              },
              { titre: TITRE, corps },
            )
            if (issue === 'expire') {
              await depot.supprimer(base.db, abonnement.id)
              abonnementsSupprimes += 1
            } else atteints += 1
          } catch (cause) {
            echecs += 1
            echecsDeLUtilisateur += 1
            causes.push(causeDeLEchec(cause))
          }
        }
        // Rien n'est parti à cause d'une panne : le jour est rendu, le prochain passage réessaiera.
        if (atteints === 0 && echecsDeLUtilisateur > 0) await depot.liberer(base.db, userId, jour)
        else rappels += 1
      }
      return { rappels, abonnementsSupprimes, echecs, causes }
    },
  }
}
export type ServiceRappels = ReturnType<typeof creerServiceRappels>
