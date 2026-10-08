import { PgBoss } from 'pg-boss'
import type { Base } from '../base/base.ts'
import type { BilanDesRappels } from '../types.ts'

export const FILE_RAPPELS = 'rappels'
/** Toutes les 5 minutes. */
const CRON_RAPPELS = '*/5 * * * *'
const CLE_RAPPELS = 'rappels'
/** Un passage de moins de 4 minutes après le précédent est ignoré, même lancé par une autre instance. */
const SECONDES_ENTRE_DEUX_PASSAGES = 240

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
}: {
  readonly proprietaire: Base
  readonly envoyerLesRappels: () => Promise<BilanDesRappels>
  readonly erreur: (message: string, cause: unknown) => void
}): Promise<TachesPlanifiees> {
  const boss = new PgBoss({
    db: {
      executeSql: async (texte, valeurs) => ({
        rows: (await proprietaire.executer(texte, valeurs)).rows,
      }),
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
    await envoyerLesRappels()
  })
  return { boss, arreter: () => boss.stop() }
}
