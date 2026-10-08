import { describe, expect, it } from 'vitest'
import { construireEnvoi, lireDsn } from './suiviErreurs.ts'

const CONTEXTE = {
  plateforme: 'node',
  instant: '2026-10-08T10:00:00.000Z',
  identifiant: 'a'.repeat(32),
} as const

describe('lireDsn', () => {
  it('compose l’adresse d’envoi avec la clé et le projet', () => {
    expect(lireDsn('https://cle123@erreurs.exemple.fr/7')?.urlEnvoi).toBe(
      'https://erreurs.exemple.fr/api/7/envelope/?sentry_key=cle123&sentry_version=7',
    )
  })

  it('garde un préfixe de chemin (GlitchTip auto-hébergé)', () => {
    expect(lireDsn('https://cle@h.fr/sous/dossier/3')?.urlEnvoi).toBe(
      'https://h.fr/sous/dossier/api/3/envelope/?sentry_key=cle&sentry_version=7',
    )
  })

  it.each([undefined, '', 'pas une adresse', 'https://h.fr/7', 'https://cle@h.fr'])(
    'rend null pour %s : rien ne sera envoyé',
    (dsn) => {
      expect(lireDsn(dsn)).toBeNull()
    },
  )
})

describe('construireEnvoi', () => {
  const dsn = lireDsn('https://cle@h.fr/7')
  if (dsn === null) throw new Error('DSN de test invalide')

  it('ne contient ni le message ni autre chose que le type, la pile et les étiquettes', () => {
    const pile = [
      'TypeError: le secret de la réponse saisie',
      '    at calculer (/app/src/service.ts:12:5)',
      '    at /app/src/routes.ts:40:9',
    ].join('\n')

    const { corps } = construireEnvoi(
      dsn,
      { nom: 'TypeError', pile, etiquettes: { route: '/api/cartes/:id/note' } },
      CONTEXTE,
    )

    expect(corps).not.toContain('secret')
    const lignes = corps.trim().split('\n')
    expect(lignes).toHaveLength(3)
    expect(JSON.parse(lignes[1] ?? '')).toEqual({ type: 'event' })
    const evenement: unknown = JSON.parse(lignes[2] ?? '')
    expect(evenement).toMatchObject({
      event_id: CONTEXTE.identifiant,
      timestamp: CONTEXTE.instant,
      platform: 'node',
      level: 'error',
      tags: { route: '/api/cartes/:id/note' },
      exception: {
        values: [
          {
            type: 'TypeError',
            stacktrace: {
              frames: [
                { filename: '/app/src/routes.ts', lineno: 40, colno: 9 },
                { function: 'calculer', filename: '/app/src/service.ts', lineno: 12, colno: 5 },
              ],
            },
          },
        ],
      },
    })
  })

  it('lit aussi les piles de Firefox', () => {
    const { corps } = construireEnvoi(
      dsn,
      { nom: 'Error', pile: 'ouvrir@https://app.exemple.fr/assets/a.js:3:14' },
      { ...CONTEXTE, plateforme: 'javascript' },
    )

    expect(corps).toContain('"function":"ouvrir"')
    expect(corps).toContain('"lineno":3')
  })
})
