import { describe, expect, it } from 'vitest'
import { MAX_ERREURS_PAR_PAGE, suivreLesErreurs } from './erreurs.ts'
import type { CibleErreurs } from './erreurs.ts'

/** Une fenêtre factice : on y déclenche les erreurs à la main. */
function fenetreFactice() {
  const ecouteurs: ((cause: unknown) => void)[] = []
  const cible: CibleErreurs = { surErreur: (ecouteur) => ecouteurs.push(ecouteur) }
  const declencher = (cause: unknown) => {
    for (const ecouteur of ecouteurs) ecouteur(cause)
  }
  return { cible, erreur: declencher, rejet: declencher }
}

function monter(dsn: string | undefined) {
  const fenetre = fenetreFactice()
  const envois: { url: string; corps: string }[] = []
  const actif = suivreLesErreurs({
    dsn,
    cible: fenetre.cible,
    maintenant: () => '2026-10-08T10:00:00.000Z',
    envoyer: (url, corps) => envois.push({ url, corps }),
    identifiant: () => 'c'.repeat(32),
  })
  return { ...fenetre, actif, envois }
}

describe('suivi d’erreurs du front', () => {
  it('sans DSN, n’écoute rien et n’envoie rien', () => {
    const { actif, envois, erreur } = monter(undefined)

    erreur(new Error('x'))

    expect(actif).toBe(false)
    expect(envois).toEqual([])
  })

  it('envoie le type et la pile d’une erreur non rattrapée, jamais son message', () => {
    const { actif, envois, erreur } = monter('https://cle@erreurs.test/2')

    erreur(new RangeError('texte saisi : hunter2'))

    expect(actif).toBe(true)
    expect(envois).toHaveLength(1)
    expect(envois[0]?.url).toBe(
      'https://erreurs.test/api/2/envelope/?sentry_key=cle&sentry_version=7',
    )
    expect(envois[0]?.corps).toContain('"type":"RangeError"')
    expect(envois[0]?.corps).not.toContain('hunter2')
  })

  it('signale aussi une promesse rejetée, et s’arrête après le plafond', () => {
    const { envois, rejet } = monter('https://cle@erreurs.test/2')

    for (let i = 0; i < MAX_ERREURS_PAR_PAGE + 5; i += 1) rejet(new Error('refus'))

    expect(envois).toHaveLength(MAX_ERREURS_PAR_PAGE)
  })
})
