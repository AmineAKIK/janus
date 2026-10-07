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
    duree_max_s: 60,
    reussites_requises: 3,
    sur_jours_differents: 2,
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
  it('compte les réussites sous l’objectif et les jours différents', () => {
    const faits: Fait[] = [
      essai('B02', '2026-10-12T10:00:00Z', true, 45),
      essai('B02', '2026-10-12T15:00:00Z', true, 58),
      // Réussi mais trop lent : compte pour le meilleur temps seulement.
      essai('B02', '2026-10-13T10:00:00Z', true, 75),
      // Raté : ne compte pas.
      essai('B02', '2026-10-13T11:00:00Z', false, 20),
      // Autre bloc.
      essai('B03', '2026-10-13T11:00:00Z', true, 10),
    ]
    const [ligne] = aisanceDesBlocs([avecCible], faits, REGLAGES)
    expect(ligne).toEqual({
      bloc: 'B02',
      titre: 'Les boucles',
      cible: {
        libelle: 'Écrire une boucle',
        objectifS: 60,
        meilleurS: 45,
        reussites: 2,
        reussitesRequises: 3,
        jours: 1,
        joursRequis: 2,
      },
    })
  })

  it('compte deux séances de part et d’autre de la bascule comme deux jours', () => {
    const faits = [
      // 03:30 à Paris : encore la veille.
      essai('B02', '2026-10-13T01:30:00Z', true, 50),
      essai('B02', '2026-10-13T10:00:00Z', true, 50),
    ]
    expect(aisanceDesBlocs([avecCible], faits, REGLAGES)[0]?.cible?.jours).toBe(2)
  })

  it('marque « non requis » un bloc sans cible et reste vide sans essai', () => {
    const lignes = aisanceDesBlocs([sansCible, avecCible], [], REGLAGES)
    expect(lignes[0]).toEqual({ bloc: 'B03', titre: 'Les fonctions', cible: null })
    expect(lignes[1]?.cible).toMatchObject({ meilleurS: null, reussites: 0, jours: 0 })
  })
})
