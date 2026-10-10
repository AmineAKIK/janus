import { ErreurApi, ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo, RACINE_FICHES } from './banc.ts'

describe('routes de catalogue de la démo', () => {
  it('rend la formation DWWM et ses modules, dont un seul importé', async () => {
    const { transport } = monterDemo()

    const { formations } = await transport.appeler(ROUTES['GET /formations'], {})
    const { modules } = await transport.appeler(ROUTES['GET /formations/:id/modules'], {
      params: { id: formations[0]?.id ?? '' },
    })

    expect(formations).toHaveLength(1)
    expect(formations[0]?.titre).toBe('Développeur web et web mobile')
    expect(modules.map(({ code, importe }) => [code, importe])).toEqual([
      ['M1', true],
      ['M2', false],
      ['M3', false],
      ['M4', false],
    ])
  })

  it('liste les 20 blocs du module 1, avec les statuts du jeu d’exemple', async () => {
    const { transport } = monterDemo()

    const { blocs } = await transport.appeler(ROUTES['GET /modules/:id/blocs'], {
      params: { id: 'M1' },
    })

    expect(blocs).toHaveLength(20)
    expect(blocs.slice(0, 8).map(({ bloc, statut }) => `${bloc} ${statut}`)).toEqual([
      'B01 acquis',
      'B02 acquis_provisoirement',
      'B03 en_cours',
      'B04 a_reprendre',
      'B05 vu',
      'B06 acquis',
      'B07 acquis_provisoirement',
      'B08 non_commence',
    ])
    expect(blocs[3]).toMatchObject({ partie: 'P1 Machine et logique', prerequis: ['B01', 'B03'] })
  })

  it('rend une liste vide pour un module pas encore importé', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['GET /modules/:id/blocs'], { params: { id: 'M2' } }),
    ).resolves.toEqual({ blocs: [] })
  })

  it('rend le détail d’un bloc : manifeste, statut recalculé, accès et adresse de la fiche', async () => {
    const { transport } = monterDemo()

    const b04 = await transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: 'B04' } })
    const b08 = await transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: 'B08' } })

    expect(b04).toMatchObject({
      bloc: 'B04',
      statut: 'a_reprendre',
      erreurs_ouvertes: ['confond_compilateur_interpreteur'],
      acces: 'raison_requise',
      force: null,
      etat_page: null,
      module: 'M1',
      problemes: [],
      serie_ouverte: { restitution: true, consolidation: false },
      fiche_url: `${RACINE_FICHES}demo/fiche-demo.html?v=2`,
    })
    expect(b04.manifeste.bloc).toBe('B04')
    expect(b08).toMatchObject({ statut: 'non_commence', acces: 'raison_requise' })
  })

  it('recalcule les statuts avec l’horloge de la démo', async () => {
    const { transport, horloge } = monterDemo()
    const statutDe = async () =>
      (await transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: 'B07' } })).manque.map(
        ({ code }) => code,
      )

    expect(await statutDe()).toContain('verification_a_venir')
    horloge.avancer(3 * 24 * 3_600_000)
    expect(await statutDe()).toContain('verification_a_faire')
  })

  it('répond 404 pour une formation, un module ou un bloc inconnu', async () => {
    const { transport } = monterDemo()
    const appels = [
      transport.appeler(ROUTES['GET /formations/:id/modules'], { params: { id: 'X' } }),
      transport.appeler(ROUTES['GET /modules/:id/blocs'], { params: { id: 'X' } }),
      transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: 'B99' } }),
    ]

    for (const appel of appels) {
      await expect(appel).rejects.toMatchObject({ status: 404, code: 'introuvable' })
      await expect(appel).rejects.toBeInstanceOf(ErreurApi)
    }
  })
})
