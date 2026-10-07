import { nouvelId, ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo, PREMIER_LANCEMENT } from './banc.ts'

const lire = (banc: ReturnType<typeof monterDemo>, requete = {}) =>
  banc.transport.appeler(ROUTES['GET /tableau-de-bord'], { requete })

describe('tableau de bord de la démo, avec la graine', () => {
  it('rend les 20 blocs du module 1 dans l’ordre du plan, par partie', async () => {
    const vue = await lire(monterDemo())

    expect(vue.modules.map(({ id }) => id)).toEqual(['M1'])
    expect(vue.module).toMatchObject({ id: 'M1' })
    expect(vue.periode).toBe('30j')
    expect(vue.blocs).toHaveLength(20)
    expect(vue.blocs.map(({ bloc }) => bloc).slice(0, 3)).toEqual(['B01', 'B02', 'B03'])
    expect(vue.blocs[0]?.partie).toMatch(/^P1 /)
  })

  it('marque B07 « prérequis non validé » et le liste avec sa raison', async () => {
    const vue = await lire(monterDemo(), { periode: 'tout' })

    expect(vue.blocs.find(({ bloc }) => bloc === 'B07')?.prerequis_non_valides).toBe(true)
    const ligne = vue.decisions.sans_prerequis.find(({ bloc }) => bloc === 'B07')
    expect(ligne?.raison).toBeTruthy()
  })

  it('compte les erreurs ouvertes, B04 à reprendre', async () => {
    const vue = await lire(monterDemo(), { periode: 'tout' })

    const ouvertes = vue.erreurs.filter(({ ouverte }) => ouverte)
    expect(ouvertes.some(({ blocs }) => blocs.includes('B04'))).toBe(true)
    const nombres = vue.erreurs.map(({ nombre }) => nombre)
    expect(nombres).toEqual([...nombres].sort((a, b) => b - a))
  })

  it('compte les tâches du jour et rend les trois premières', async () => {
    const banc = monterDemo()
    const vue = await lire(banc)
    const jour = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})

    expect(vue.a_faire.aujourdhui).toBe(jour.taches.filter(({ faite }) => !faite).length)
    expect(vue.a_faire.taches).toEqual(jour.taches.filter(({ faite }) => !faite).slice(0, 3))
  })

  it('refuse rien : un module inconnu donne une carte vide', async () => {
    const vue = await lire(monterDemo(), { module: 'M9' })

    expect(vue.module).toBeNull()
    expect(vue.blocs).toEqual([])
  })

  it('forcer B03 à « Vu » l’affiche partout, revenir au calculé le rétablit', async () => {
    const banc = monterDemo()
    const avant = await lire(banc)
    const calcule = avant.blocs.find(({ bloc }) => bloc === 'B03')?.statut

    const force = await banc.transport.appeler(ROUTES['POST /blocs/:id/forcer'], {
      params: { id: 'B03' },
      corps: {
        action: 'forcer',
        id: nouvelId(Date.parse(PREMIER_LANCEMENT)),
        statut: 'vu',
        raison: 'Je l’ai vu en cours.',
      },
    })
    const pendant = await lire(banc)

    expect(force.statut).toBe('vu')
    expect(pendant.blocs.find(({ bloc }) => bloc === 'B03')).toMatchObject({
      statut: 'vu',
      force: true,
    })
    expect(pendant.decisions.forces[0]).toMatchObject({
      bloc: 'B03',
      statut: 'vu',
      raison: 'Je l’ai vu en cours.',
    })

    await banc.transport.appeler(ROUTES['POST /blocs/:id/forcer'], {
      params: { id: 'B03' },
      corps: { action: 'lever', id: nouvelId(Date.parse(PREMIER_LANCEMENT) + 1) },
    })
    const apres = await lire(banc)
    expect(apres.blocs.find(({ bloc }) => bloc === 'B03')).toMatchObject({
      statut: calcule,
      force: false,
    })
  })

  it('le coût de l’IA suit les corrections du mois et le plafond atteint', async () => {
    const banc = monterDemo()
    const vue = await lire(banc)
    expect(vue.cout_ia.plafond_millioniemes).toBe(10_000_000)
    expect(vue.cout_ia.depense_millioniemes).toBeGreaterThan(0)

    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, plafondAtteint: true },
    }))
    expect((await lire(banc)).cout_ia.depense_millioniemes).toBe(10_000_000)
  })

  it('rend les mesures de la graine ; la période change la calibration, pas la carte ni les semaines', async () => {
    const banc = monterDemo()
    const long = await lire(banc, { periode: 'tout' })
    const court = await lire(banc, { periode: '7j' })

    expect(long.mesures.autonomie.semaines.map(({ debut }) => debut)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ])
    expect(long.mesures.autonomie.aide_moyenne).toBe(0)
    expect(long.mesures.calibration.lignes[0]).toEqual({ confiance: 'sur', justes: 39, faux: 3 })
    expect(long.mesures.aisance).toHaveLength(20)
    expect(long.mesures.aisance[0]?.cible).toMatchObject({ objectif_s: 30, reussites: 0 })

    const lignesCourtes = court.mesures.calibration.lignes
    expect(lignesCourtes[0]?.justes).toBeLessThan(39)
    expect(court.blocs).toEqual(long.blocs)
    expect(court.mesures.autonomie).toEqual(long.mesures.autonomie)
    expect(court.mesures.aisance).toEqual(long.mesures.aisance)
  })

  it('mesure la rétention : questions et vérifications de la graine, puis une carte notée', async () => {
    const banc = monterDemo()
    const avant = await lire(banc)
    expect(avant.mesures.retention.map(({ debut }) => debut)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ])
    expect(avant.mesures.retention.every(({ cartes }) => cartes.total === 0)).toBe(true)

    const { nouvelles } = await banc.transport.appeler(ROUTES['GET /cartes/dues'], {})
    const carte = nouvelles[0]
    if (carte === undefined) throw new Error('Aucune carte')
    await banc.transport.appeler(ROUTES['POST /cartes/:id/note'], {
      params: { id: carte.id },
      corps: { id: nouvelId(7), note: 'a_revoir' },
    })
    await banc.transport.appeler(ROUTES['POST /cartes/:id/note'], {
      params: { id: carte.id },
      corps: { id: nouvelId(8), note: 'bien' },
    })

    const apres = await lire(banc)
    expect(apres.mesures.retention.at(-1)?.cartes).toEqual({ reussis: 1, total: 2 })
  })
})
