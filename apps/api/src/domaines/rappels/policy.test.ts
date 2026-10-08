import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { ceQuiEstDu, rappelAEnvoyer, texteDuRappel } from './policy.ts'

const reglages = (surcharge: Record<string, unknown> = {}) => Reglages.parse(surcharge)
// 2026-10-05, 17:30 UTC = 19:30 à Paris (UTC+2).
const APRES_L_HEURE = '2026-10-05T17:30:00.000Z'
const AVANT_L_HEURE = '2026-10-05T16:00:00.000Z'

describe('rappelAEnvoyer', () => {
  it('attend l’heure choisie, dans le fuseau de l’utilisateur', () => {
    expect(rappelAEnvoyer(reglages(), AVANT_L_HEURE).aEnvoyer).toBe(false)
    expect(rappelAEnvoyer(reglages(), APRES_L_HEURE)).toEqual({
      aEnvoyer: true,
      jour: '2026-10-05',
    })
    expect(rappelAEnvoyer(reglages({ fuseau: 'America/New_York' }), APRES_L_HEURE).aEnvoyer).toBe(
      false,
    )
  })

  it('suit l’heure de rappel réglée', () => {
    expect(rappelAEnvoyer(reglages({ heureRappel: '18:00' }), AVANT_L_HEURE).aEnvoyer).toBe(true)
  })

  it('ne part pas pendant une pause, jour de reprise compris', () => {
    expect(
      rappelAEnvoyer(reglages({ rappelsEnPauseJusquAu: '2026-10-05' }), APRES_L_HEURE).aEnvoyer,
    ).toBe(false)
    expect(
      rappelAEnvoyer(reglages({ rappelsEnPauseJusquAu: '2026-10-04' }), APRES_L_HEURE).aEnvoyer,
    ).toBe(true)
  })

  it('compte le jour avec la bascule : à 1 h 30 on est encore la veille', () => {
    expect(rappelAEnvoyer(reglages(), '2026-10-05T23:30:00.000Z').jour).toBe('2026-10-05')
    expect(rappelAEnvoyer(reglages(), '2026-10-05T23:30:00.000Z').aEnvoyer).toBe(false)
  })
})

describe('texteDuRappel', () => {
  it.each([
    [{ cartes: 12, verifications: 1 }, '12 cartes et 1 vérification t’attendent'],
    [{ cartes: 1, verifications: 1 }, '1 carte et 1 vérification t’attendent'],
    [{ cartes: 1, verifications: 0 }, '1 carte t’attend'],
    [{ cartes: 0, verifications: 1 }, '1 vérification t’attend'],
    [{ cartes: 3, verifications: 0 }, '3 cartes t’attendent'],
    [{ cartes: 0, verifications: 2 }, '2 vérifications t’attendent'],
    [{ cartes: 0, verifications: 0 }, null],
  ])('%j', (du, attendu) => {
    expect(texteDuRappel(du)).toBe(attendu)
  })
})

describe('ceQuiEstDu', () => {
  const base = { jour: '2026-10-05', en_retard: false, premiere_connexion: false, module: null }
  it('compte les cartes dues et les vérifications pas encore faites', () => {
    const du = ceQuiEstDu({
      ...base,
      taches: [
        { tache: { type: 'cartes', dues: 4, nouvelles: 9 }, lien: '/cartes', faite: false },
        {
          tache: { type: 'verification', bloc: 'D01', apres: '2026-10-05' },
          lien: '/verifications/1',
          faite: false,
        },
        {
          tache: { type: 'retest', bloc: 'D02', apres: '2026-10-05' },
          lien: '/verifications/2',
          faite: true,
        },
        { tache: { type: 'bloc', bloc: 'D03' }, lien: '/blocs/D03', faite: false },
      ],
    })
    expect(du).toEqual({ cartes: 4, verifications: 1 })
  })

  it('ne compte pas les cartes nouvelles seules', () => {
    const du = ceQuiEstDu({
      ...base,
      taches: [{ tache: { type: 'cartes', dues: 0, nouvelles: 5 }, lien: '/cartes', faite: false }],
    })
    expect(texteDuRappel(du)).toBeNull()
  })
})
