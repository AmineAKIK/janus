import { nouvelId, Reglages } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import type { Base } from '../../base/base.ts'
import type { Envoyeur } from '../../adaptateurs/push/envoyeur.ts'
import { ContenuDifferent } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import type { BilanDesRappels, LireAujourdhui } from '../../types.ts'
import type { DepotRappels } from './depot.ts'
import { ceQuiEstDu, rappelAEnvoyer, texteDuRappel } from './policy.ts'

const TITRE = 'Atelier'

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
      for (const { id: userId, reglages: brut } of await depot.destinataires(base.db)) {
        const { aEnvoyer, jour } = rappelAEnvoyer(Reglages.parse(brut), maintenant)
        if (!aEnvoyer) continue
        const corps = texteDuRappel(ceQuiEstDu(await aujourdhui(userId)))
        if (corps === null) continue
        const reserve = await depot.reserver(base.db, {
          id: identifiant(),
          userId,
          jour,
          envoyeLe: maintenant,
        })
        if (!reserve) continue
        rappels += 1
        for (const abonnement of await depot.abonnementsDe(base.db, userId)) {
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
            }
          } catch {
            echecs += 1
          }
        }
      }
      return { rappels, abonnementsSupprimes, echecs }
    },
  }
}
export type ServiceRappels = ReturnType<typeof creerServiceRappels>
