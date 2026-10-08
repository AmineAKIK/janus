import { describe, expect, it } from 'vitest'
import { ErreurConfig, lireConfig } from './config.ts'
import { ENVIRONNEMENT_TEST } from './testeur.ts'

const sansVariables = (...noms: string[]) =>
  Object.fromEntries(Object.entries(ENVIRONNEMENT_TEST).filter(([nom]) => !noms.includes(nom)))

describe('lireConfig', () => {
  it('lit l’environnement et applique les valeurs par défaut', () => {
    const sans = sansVariables('NIVEAU_JOURNAL')
    const config = lireConfig(sans)

    expect(config.NIVEAU_JOURNAL).toBe('info')
    expect(config.COOKIE_SECURE).toBe(true)
    expect(config.DEEPSEEK_API_KEY).toBeUndefined()
  })

  it('accepte la clé DeepSeek et COOKIE_SECURE=false', () => {
    const config = lireConfig({
      ...ENVIRONNEMENT_TEST,
      COOKIE_SECURE: 'false',
      DEEPSEEK_API_KEY: 'sk-test',
    })

    expect(config.COOKIE_SECURE).toBe(false)
    expect(config.DEEPSEEK_API_KEY).toBe('sk-test')
  })

  it('arrête le démarrage en nommant chaque variable qui manque', () => {
    const sans = sansVariables('DATABASE_URL', 'VAPID_SUJET')

    expect(() => lireConfig(sans)).toThrow(ErreurConfig)
    expect(() => lireConfig(sans)).toThrow(/DATABASE_URL : variable manquante/)
    expect(() => lireConfig(sans)).toThrow(/VAPID_SUJET : variable manquante/)
  })

  it('refuse une valeur invalide avec le nom de la variable', () => {
    expect(() => lireConfig({ ...ENVIRONNEMENT_TEST, ORIGINE_APPLI: 'pas une url' })).toThrow(
      /ORIGINE_APPLI/,
    )
    expect(() => lireConfig({ ...ENVIRONNEMENT_TEST, COOKIE_SECURE: 'oui' })).toThrow(
      /COOKIE_SECURE/,
    )
    expect(() => lireConfig({ ...ENVIRONNEMENT_TEST, NIVEAU_JOURNAL: 'bavard' })).toThrow(
      /NIVEAU_JOURNAL/,
    )
  })
})
