import { describe, expect, it } from 'vitest'
import { creerCompteurTempsActif, FENETRE_ACTIVITE_MS } from './tempsActif.ts'

function monter(visible = true) {
  const etat = { maintenant: 1_000_000, visible }
  const compteur = creerCompteurTempsActif({
    maintenantMs: () => etat.maintenant,
    visible: () => etat.visible,
  })
  const avancer = (ms: number) => {
    for (let i = 0; i < ms / 1000; i += 1) {
      etat.maintenant += 1000
      compteur.battre()
    }
  }
  return { compteur, etat, avancer }
}

describe('compteur de temps actif', () => {
  it('ne compte rien sans activité', () => {
    const { compteur, avancer } = monter()

    avancer(10_000)

    expect(compteur.prendre()).toBe(0)
  })

  it('compte les secondes d’une page visible avec activité récente', () => {
    const { compteur, avancer } = monter()
    compteur.activite()

    avancer(10_000)

    expect(compteur.prendre()).toBe(10)
    expect(compteur.prendre()).toBe(0)
  })

  it('arrête de compter 60 secondes après la dernière activité', () => {
    const { compteur, avancer } = monter()
    compteur.activite()

    avancer(FENETRE_ACTIVITE_MS + 30_000)

    expect(compteur.prendre()).toBe(FENETRE_ACTIVITE_MS / 1000)
  })

  it('une nouvelle activité relance le comptage', () => {
    const { compteur, avancer } = monter()
    compteur.activite()
    avancer(FENETRE_ACTIVITE_MS + 5000)
    compteur.prendre()

    compteur.activite()
    avancer(3000)

    expect(compteur.prendre()).toBe(3)
  })

  it('ne compte pas quand la page est masquée', () => {
    const { compteur, avancer, etat } = monter(false)
    compteur.activite()

    avancer(5000)
    etat.visible = true
    avancer(2000)

    expect(compteur.prendre()).toBe(2)
  })
})
