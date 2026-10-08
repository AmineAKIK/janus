import { describe, expect, it } from 'vitest'
import { lireNotification } from './notificationPush.ts'

const donnees = (valeur: unknown) => ({ json: () => valeur })

describe('lireNotification', () => {
  it('rend le message envoyé par l’API', () => {
    const message = { titre: 'Atelier', corps: '12 cartes t’attendent' }
    expect(lireNotification(donnees(message))).toEqual(message)
  })

  it.each([null, undefined, 'texte', { titre: 'Atelier' }, []])('ignore %j', (valeur) => {
    expect(lireNotification(donnees(valeur))).toBeNull()
  })

  it('ignore un événement sans données ou dont les données ne sont pas du JSON', () => {
    expect(lireNotification(null)).toBeNull()
    expect(lireNotification(undefined)).toBeNull()
    expect(
      lireNotification({
        json: () => {
          throw new SyntaxError('pas du JSON')
        },
      }),
    ).toBeNull()
  })
})
