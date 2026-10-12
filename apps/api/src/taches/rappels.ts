import { PgBoss } from 'pg-boss'
import type { Base } from '../base/base.ts'
import type { BilanDesRappels } from '../types.ts'

export const FILE_RAPPELS = 'rappels'
/** Toutes les 5 minutes. */
const CRON_RAPPELS = '*/5 * * * *'
const CLE_RAPPELS = 'rappels'
/** Un passage de moins de 4 minutes après le précédent est ignoré, même lancé par une autre instance. */
const SECONDES_ENTRE_DEUX_PASSAGES = 240

/** Le temps laissé à une tâche en cours pour finir avant l'arrêt. */
const ARRET_TACHES_MS = 5000

export interface TachesPlanifiees {
  /** Le moteur de tâches, pour les tests : lancer un passage, lire le planning. */
  readonly boss: PgBoss
  readonly arreter: () => Promise<void>
}

/**
 * Démarre la file de tâches dans le processus de l'API, sur le même pool de connexions, et
 * planifie la tâche des rappels. Il faut le rôle propriétaire : pg-boss crée son schéma.
 */
export async function demarrerLesTaches({
  proprietaire,
  envoyerLesRappels,
  erreur,
  info,
}: {
  readonly proprietaire: Base
  readonly envoyerLesRappels: () => Promise<BilanDesRappels>
  readonly erreur: (message: string, cause: unknown) => void
  /** Le bilan d'un passage qui a envoyé quelque chose ou échoué. */
  readonly info: (message: string, donnees: BilanDesRappels) => void
}): Promise<TachesPlanifiees> {
  const boss = new PgBoss({
    db: {
      // Le résultat de `pg` tel quel : pg-boss sait lire le tableau d'une requête à plusieurs instructions.
      executeSql: async (texte, valeurs) => {
        const resultat = await proprietaire.executer(texte, valeurs)
        // pg-boss déballe lui-même le tableau d'une requête à plusieurs instructions.
        return resultat as { rows: unknown[] }
      },
    },
  })
  boss.on('error', (cause) => {
    erreur('Erreur de la file de tâches', cause)
  })
  await boss.start()
  await boss.createQueue(FILE_RAPPELS)
  await boss.schedule(FILE_RAPPELS, CRON_RAPPELS, null, {
    key: CLE_RAPPELS,
    singletonKey: CLE_RAPPELS,
    singletonSeconds: SECONDES_ENTRE_DEUX_PASSAGES,
  })
  await boss.work(FILE_RAPPELS, async () => {
    const bilan = await envoyerLesRappels()
    if (bilan.rappels > 0 || bilan.echecs > 0 || bilan.abonnementsSupprimes > 0) {
      info('Rappels envoyés', bilan)
    }
    if (bilan.echecs > 0) erreur('Rappels en échec', new Error(bilan.causes.join(' ; ')))
  })
  return { boss, arreter: () => boss.stop({ graceful: true, timeout: ARRET_TACHES_MS }) }
}
