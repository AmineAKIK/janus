import { ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { etatVide } from '../store.ts'
import { monterDemo, PREMIER_LANCEMENT } from './banc.ts'

const JOUR = 24 * 60 * 60 * 1000

describe('GET /aujourdhui de la démo', () => {
  it('avec la graine, range les tâches dans l’ordre du cadrage', async () => {
    const { transport } = monterDemo()

    const { taches, premiere_connexion } = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(premiere_connexion).toBe(false)
    expect(taches.map(({ tache }) => tache.type)).toEqual([
      'reprendre_erreur',
      'questions_debut',
      'verification',
      'consolidation',
      'consolidation',
      'cartes',
      'bloc',
    ])
    expect(taches[0]?.tache).toMatchObject({ type: 'reprendre_erreur', bloc: 'B04' })
    expect(taches[2]?.tache).toMatchObject({ type: 'verification', bloc: 'B02' })
    // B04 a aussi fini sa restitution : le moteur lui garde une consolidation, même à reprendre.
    expect(taches[3]?.tache).toMatchObject({ type: 'consolidation', bloc: 'B04' })
    expect(taches[4]?.tache).toMatchObject({ type: 'consolidation', bloc: 'B05' })
    expect(taches[6]?.tache).toMatchObject({ type: 'bloc', bloc: 'B03' })
  })

  it('donne à chaque tâche son lien et la marque non faite', async () => {
    const { transport } = monterDemo()

    const { taches } = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(taches.map(({ lien }) => lien)).toEqual([
      expect.stringMatching(/^\/blocs\/B04/),
      '/questions',
      '/verifications/B02',
      expect.stringMatching(/^\/blocs\/B04\?etape=/),
      expect.stringMatching(/^\/blocs\/B05\?etape=/),
      '/revision',
      '/blocs/B03',
    ])
    expect(taches.every(({ faite }) => !faite)).toBe(true)
  })

  it('rend le module en cours avec le statut de chaque bloc', async () => {
    const { transport } = monterDemo()

    const { module } = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(module?.id).toBe('M1')
    expect(module?.blocs).toHaveLength(20)
    expect(module?.blocs.find(({ bloc }) => bloc === 'B04')?.statut).toBe('a_reprendre')
  })

  it('après dix jours sans séance, ajoute le retour avec le bon nombre de jours', async () => {
    const { transport, horloge } = monterDemo()
    expect((await transport.appeler(ROUTES['GET /aujourdhui'], {})).retour).toBeUndefined()

    horloge.avancer(10 * JOUR)
    const apres = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(apres.en_retard).toBe(true)
    expect(apres.retour?.jours).toBeGreaterThanOrEqual(9)
    expect(apres.retour?.jours).toBeLessThanOrEqual(11)
  })

  it('sans aucun fait, c’est la première connexion : une seule tâche, le premier bloc', async () => {
    const { transport, magasin } = monterDemo()
    magasin.reinitialiser({ ...etatVide(PREMIER_LANCEMENT), sessionOuverte: true })

    const reponse = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(reponse.premiere_connexion).toBe(true)
    expect(reponse.taches.map(({ tache }) => tache)).toEqual([{ type: 'bloc', bloc: 'B01' }])
    expect(reponse.retour).toBeUndefined()
  })

  it('l’interrupteur « tout fait » marque toutes les tâches comme faites', async () => {
    const { transport, magasin } = monterDemo()
    magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, toutFait: true },
    }))

    const { taches } = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(taches.length).toBeGreaterThan(0)
    expect(taches.every(({ faite }) => faite)).toBe(true)
  })

  it('date la journée avec la bascule : un fait à 2 h compte pour la veille', async () => {
    const { transport } = monterDemo()

    const { jour } = await transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(jour).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
