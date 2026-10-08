import { describe, expect, it } from 'vitest'
import { horlogeFausse } from '../testeur.ts'
import { creerSuiviErreurs } from './suiviErreurs.ts'

const REQUETE = { method: 'POST', routeOptions: { url: '/api/corrections' } }

function monter(dsn: string | undefined, envoyer: (url: string, corps: string) => Promise<void>) {
  const echecs: unknown[] = []
  const signaler = creerSuiviErreurs({
    dsn,
    horloge: horlogeFausse(),
    envoyer,
    identifiant: () => 'b'.repeat(32),
    echec: (cause) => echecs.push(cause),
  })
  return { signaler, echecs }
}

describe('suivi d’erreurs de l’API', () => {
  it('n’existe pas sans DSN : rien n’est envoyé', () => {
    expect(monter(undefined, () => Promise.resolve()).signaler).toBeUndefined()
    expect(monter('pas un dsn', () => Promise.resolve()).signaler).toBeUndefined()
  })

  it('envoie le type, la pile et la route, sans le message de l’erreur', () => {
    const envois: { url: string; corps: string }[] = []
    const { signaler } = monter('https://cle@erreurs.test/4', (url, corps) => {
      envois.push({ url, corps })
      return Promise.resolve()
    })
    const erreur = new TypeError('réponse saisie : hunter2')

    signaler?.(erreur, REQUETE)

    expect(envois).toHaveLength(1)
    expect(envois[0]?.url).toBe(
      'https://erreurs.test/api/4/envelope/?sentry_key=cle&sentry_version=7',
    )
    const corps = envois[0]?.corps ?? ''
    expect(corps).not.toContain('hunter2')
    expect(corps).toContain('"type":"TypeError"')
    expect(corps).toContain('"route":"/api/corrections"')
    expect(corps).toContain('"timestamp":"2026-10-01T10:00:00.000Z"')
  })

  it('un envoi qui échoue est noté sans jamais remonter', async () => {
    const { signaler, echecs } = monter('https://cle@erreurs.test/4', () =>
      Promise.reject(new Error('réseau coupé')),
    )

    signaler?.(new Error('x'), REQUETE)
    await Promise.resolve()
    await Promise.resolve()

    expect(echecs).toHaveLength(1)
  })
})
