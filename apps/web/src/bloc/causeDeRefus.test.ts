import { ErreurApi } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { causeDeRefus } from './useHoteFiche.ts'

const erreur = (status: number, code: ErreurApi['code']) =>
  new ErreurApi({ status, code, titre: 'Refus', detail: 'Refus' })

describe('causeDeRefus', () => {
  it('ne parle de plafond que lorsque le budget est atteint', () => {
    expect(causeDeRefus(erreur(429, 'budget_atteint')).code).toBe('plafond_atteint')
  })

  it('un 429 de limite de débit se réessaie : ce n’est pas le plafond', () => {
    expect(causeDeRefus(erreur(429, 'trop_de_requetes')).code).toBe('correction_indisponible')
  })

  it('une panne de l’IA est une correction indisponible, un autre refus un message refusé', () => {
    expect(causeDeRefus(erreur(503, 'erreur_interne')).code).toBe('correction_indisponible')
    expect(causeDeRefus(erreur(500, 'erreur_interne'))).toEqual({
      code: 'correction_indisponible',
      detail: 'erreur du serveur',
    })
    expect(causeDeRefus(erreur(400, 'donnees_invalides')).code).toBe('message_refuse')
    expect(causeDeRefus(new Error('réseau')).code).toBe('message_refuse')
  })
})
