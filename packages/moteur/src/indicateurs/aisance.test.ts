import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import { MANIFESTE } from '../fabrique.ts'
import { aisanceDesBlocs } from './aisance.ts'

const REGLAGES = Reglages.parse({})

const avecCible = {
  ...MANIFESTE,
  bloc: 'B02',
  titre_court: 'Les boucles',
  aisance: {
    libelle: 'Écrire une boucle',
    paliers_s: [60, 45, 30],
  },
}
const sansCible = { ...structuredClone(MANIFESTE), bloc: 'B03', titre_court: 'Les fonctions' }
Reflect.deleteProperty(sansCible, 'aisance')

let numero = 0
const essai = (bloc: string, date: string, reussi: boolean, dureeS: number): Fait => ({
  id: `f${String((numero += 1))}`,
  bloc,
  date,
  type: 'aisance_resultat',
  reussi,
  dureeS,
})

describe('aisanceDesBlocs', () => {
  it('valide les paliers dans l’ordre, un par jour au plus', () => {
    const faits: Fait[] = [
      // Palier 1 (60 s) validé.
      essai('B02', '2026-10-12T10:00:00Z', true, 58),
      // Le même jour : entraînement, même sous le palier 2.
      essai('B02', '2026-10-12T15:00:00Z', true, 40),
      // Le lendemain, trop lent pour le palier 2 (45 s).
      essai('B02', '2026-10-13T10:00:00Z', true, 50),
      // Puis validé : palier 2. Le meilleur temps, lui, compte toute réussite.
      essai('B02', '2026-10-13T11:00:00Z', true, 44),
      // Raté : ne compte pas.
      essai('B02', '2026-10-14T11:00:00Z', false, 20),
      // Autre bloc.
      essai('B03', '2026-10-13T11:00:00Z', true, 10),
    ]
    const complets: Fait[] = [
      ...faits,
      // Palier 3 (30 s) validé : la cible est atteinte.
      essai('B02', '2026-10-15T11:00:00Z', true, 28),
      // Après la cible, une série ne change plus rien.
      essai('B02', '2026-10-16T11:00:00Z', true, 12),
    ]
    expect(aisanceDesBlocs([avecCible], complets, REGLAGES)[0]?.cible).toMatchObject({
      paliersReussis: 3,
      meilleurS: 12,
    })
    const [ligne] = aisanceDesBlocs([avecCible], faits, REGLAGES)
    expect(ligne).toEqual({
      bloc: 'B02',
      titre: 'Les boucles',
      cible: {
        libelle: 'Écrire une boucle',
        paliersS: [60, 45, 30],
        meilleurS: 40,
        paliersReussis: 2,
      },
    })
  })

  it('compte deux séances de part et d’autre de la bascule comme deux jours', () => {
    const faits = [
      // 03:30 à Paris : encore la veille.
      essai('B02', '2026-10-13T01:30:00Z', true, 50),
      essai('B02', '2026-10-13T10:00:00Z', true, 44),
    ]
    expect(aisanceDesBlocs([avecCible], faits, REGLAGES)[0]?.cible?.paliersReussis).toBe(2)
  })

  it('marque « non requis » un bloc sans cible et reste vide sans essai', () => {
    const lignes = aisanceDesBlocs([sansCible, avecCible], [], REGLAGES)
    expect(lignes[0]).toEqual({ bloc: 'B03', titre: 'Les fonctions', cible: null })
    expect(lignes[1]?.cible).toMatchObject({ meilleurS: null, paliersReussis: 0 })
  })
})
