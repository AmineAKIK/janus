import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { baseDepuisPool } from '../base/base.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../base/testeurBase.ts'
import { demarrerLesTaches, FILE_RAPPELS } from './rappels.ts'
import type { TachesPlanifiees } from './rappels.ts'

describe.skipIf(URL_SERVEUR_TEST === undefined)('tâche des rappels contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let taches: TachesPlanifiees
  const envoyerLesRappels = vi.fn(() =>
    Promise.resolve({ rappels: 0, abonnementsSupprimes: 0, echecs: 0, causes: [] as string[] }),
  )

  const erreursDeLaFile: unknown[] = []
  const bilansJournalises: string[] = []

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    taches = await demarrerLesTaches({
      proprietaire: baseDepuisPool(bases.db, bases.pool),
      envoyerLesRappels,
      erreur: (_message, cause) => {
        erreursDeLaFile.push(cause)
      },
      info: (message) => {
        bilansJournalises.push(message)
      },
    })
  })
  afterAll(async () => {
    await taches.arreter()
    await bases.supprimer()
  })

  it('planifie les rappels toutes les 5 minutes, avec une clé de singleton', async () => {
    const [planning] = await taches.boss.getSchedules(FILE_RAPPELS)

    expect(planning).toMatchObject({
      name: FILE_RAPPELS,
      cron: '*/5 * * * *',
      options: { singletonKey: 'rappels' },
    })
  })

  it('lance le service des rappels quand un passage arrive', async () => {
    await taches.boss.send(FILE_RAPPELS)

    await vi.waitFor(
      () => {
        expect(envoyerLesRappels).toHaveBeenCalled()
      },
      { timeout: 15_000 },
    )
  })

  it('journalise un passage qui a envoyé ou échoué, pas un passage à vide', async () => {
    expect(bilansJournalises).toEqual([])
    envoyerLesRappels.mockResolvedValueOnce({
      rappels: 1,
      abonnementsSupprimes: 0,
      echecs: 1,
      causes: ['Error : panne'],
    })
    const erreursAvant = erreursDeLaFile.length

    await taches.boss.send(FILE_RAPPELS)

    await vi.waitFor(
      () => {
        expect(bilansJournalises).toEqual(['Rappels envoyés'])
      },
      { timeout: 15_000 },
    )
    expect(erreursDeLaFile).toHaveLength(erreursAvant + 1)
    erreursDeLaFile.length = 0
  })

  it('la supervision de la file (expiration, archivage) passe sans erreur', async () => {
    await taches.boss.supervise(FILE_RAPPELS)

    expect(erreursDeLaFile).toEqual([])
  })

  it('replanifier au démarrage suivant ne double pas le planning', async () => {
    await taches.boss.schedule(FILE_RAPPELS, '*/5 * * * *', null, { key: 'rappels' })

    expect(await taches.boss.getSchedules(FILE_RAPPELS)).toHaveLength(1)
  })
})
