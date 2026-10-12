import { describe, expect, it } from 'vitest'
import {
  ajouterJours,
  ajouterMois,
  analyser,
  enTetesSemaine,
  formater,
  grilleDuMois,
  jourDeSemaine,
  libelleLong,
  libelleMois,
} from './calendrier.ts'

describe('calendrier', () => {
  it('lit et écrit une date AAAA-MM-JJ, et refuse une date qui n’existe pas', () => {
    expect(analyser('2026-10-12')).toEqual({ annee: 2026, mois: 10, jour: 12 })
    expect(formater({ annee: 2026, mois: 3, jour: 4 })).toBe('2026-03-04')
    expect(analyser('2026-02-30')).toBeNull()
    expect(analyser('2026-13-01')).toBeNull()
    expect(analyser('')).toBeNull()
    expect(analyser('12/10/2026')).toBeNull()
  })

  it('décale de jours à travers les mois et les années', () => {
    expect(ajouterJours({ annee: 2026, mois: 12, jour: 31 }, 1)).toEqual({
      annee: 2027,
      mois: 1,
      jour: 1,
    })
    expect(ajouterJours({ annee: 2026, mois: 3, jour: 1 }, -1)).toEqual({
      annee: 2026,
      mois: 2,
      jour: 28,
    })
  })

  it('décale de mois en gardant le dernier jour du mois d’arrivée', () => {
    expect(ajouterMois({ annee: 2026, mois: 1, jour: 31 }, 1)).toEqual({
      annee: 2026,
      mois: 2,
      jour: 28,
    })
    expect(ajouterMois({ annee: 2026, mois: 1, jour: 15 }, -1)).toEqual({
      annee: 2025,
      mois: 12,
      jour: 15,
    })
    expect(ajouterMois({ annee: 2026, mois: 10, jour: 12 }, 12)).toEqual({
      annee: 2027,
      mois: 10,
      jour: 12,
    })
  })

  it('compte les jours de la semaine à partir du lundi', () => {
    expect(jourDeSemaine({ annee: 2026, mois: 10, jour: 12 })).toBe(0)
    expect(jourDeSemaine({ annee: 2026, mois: 10, jour: 18 })).toBe(6)
  })

  it('dessine six semaines du lundi au dimanche autour du mois', () => {
    const grille = grilleDuMois(2026, 10)

    expect(grille).toHaveLength(6)
    expect(grille.every((semaine) => semaine.length === 7)).toBe(true)
    expect(formater(grille[0]?.[0] ?? { annee: 0, mois: 1, jour: 1 })).toBe('2026-09-28')
    expect(formater(grille[5]?.[6] ?? { annee: 0, mois: 1, jour: 1 })).toBe('2026-11-08')
  })

  it('écrit les noms en français', () => {
    expect(libelleMois({ annee: 2026, mois: 10, jour: 12 })).toBe('octobre 2026')
    expect(libelleLong({ annee: 2026, mois: 10, jour: 12 })).toBe('12 octobre 2026')
    expect(enTetesSemaine().map(({ court }) => court)).toEqual([
      'lu',
      'ma',
      'me',
      'je',
      've',
      'sa',
      'di',
    ])
  })
})
