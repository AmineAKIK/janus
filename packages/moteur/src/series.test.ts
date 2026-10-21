import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import { auMoinsVu, seriesOuvertes } from './series.ts'
import { calculerBloc } from './statut.ts'

const calcul = (faits: Parameters<typeof calculerBloc>[0], maintenant = apres(DEBUT, 1)) =>
  calculerBloc(faits, MANIFESTE, REGLAGES, maintenant)

describe('seriesOuvertes', () => {
  it('avant la restitution : seule la restitution est ouverte', () => {
    const etat = calcul([])

    expect(auMoinsVu(etat)).toBe(false)
    expect(seriesOuvertes(etat)).toEqual({ restitution: true })
  })

  it('restitution faite : plus de série ouverte', () => {
    const f = fabrique()
    const etat = calcul([...f.restitution(DEBUT)], apres(DEBUT, 0, 10))

    expect(auMoinsVu(etat)).toBe(true)
    expect(seriesOuvertes(etat)).toEqual({ restitution: false })
  })

  it('une erreur critique rouvre la restitution', () => {
    const f = fabrique()
    const etat = calcul(
      [
        ...f.restitution(DEBUT),
        f.cochee(apres(DEBUT, 0, 5), MANIFESTE.erreurs_critiques[0]?.id ?? 'E1'),
      ],
      apres(DEBUT, 0, 200),
    )

    expect(etat.statutCalcule).toBe('a_reprendre')
    expect(seriesOuvertes(etat)).toEqual({ restitution: true })
  })

  it('un statut forcé ne ferme aucune série', () => {
    const f = fabrique()
    const etat = calcul(
      [...f.restitution(DEBUT), f.force(apres(DEBUT, 0, 5), 'acquis', 'Je le maîtrise déjà.')],
      apres(DEBUT, 0, 200),
    )

    expect(etat.statut).toBe('acquis')
    expect(seriesOuvertes(etat)).toEqual({ restitution: false })
  })

  it('un bloc « à reprendre » ou forcé plus bas reste vu ; forcé à « vu », il l’est aussi', () => {
    const f = fabrique()
    const reprendre = calcul([
      ...f.restitution(DEBUT),
      f.cochee(apres(DEBUT, 0, 5), MANIFESTE.erreurs_critiques[0]?.id ?? 'E1'),
    ])
    const forceBas = calcul([
      ...f.restitution(DEBUT),
      f.force(apres(DEBUT, 0, 5), 'non_commence', 'Je repars de zéro.'),
    ])
    const forceVu = calcul([f.force(DEBUT, 'vu', 'Je connais déjà ce bloc.')])

    expect(auMoinsVu(reprendre)).toBe(true)
    expect(auMoinsVu(forceBas)).toBe(true)
    expect(auMoinsVu(forceVu)).toBe(true)
  })
})
