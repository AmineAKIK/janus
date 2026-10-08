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

  it('lit le DSN du suivi d’erreurs, facultatif', () => {
    expect(lireConfig(ENVIRONNEMENT_TEST).SENTRY_DSN).toBeUndefined()
    expect(lireConfig({ ...ENVIRONNEMENT_TEST, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined()
    expect(
      lireConfig({ ...ENVIRONNEMENT_TEST, SENTRY_DSN: 'https://cle@erreurs.test/1' }).SENTRY_DSN,
    ).toBe('https://cle@erreurs.test/1')
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

  it('lit le modèle et les tarifs de correction dans la configuration, avec des valeurs par défaut', () => {
    const defaut = lireConfig(ENVIRONNEMENT_TEST)
    const choisie = lireConfig({
      ...ENVIRONNEMENT_TEST,
      DEEPSEEK_MODELE: 'deepseek-v4-pro',
      DEEPSEEK_TEMPERATURE: '0.1',
      DEEPSEEK_PRIX_SORTIE: '2000000',
    })

    expect(defaut).toMatchObject({
      DEEPSEEK_MODELE: 'deepseek-flash',
      DEEPSEEK_URL: 'https://api.deepseek.com',
      DEEPSEEK_TEMPERATURE: 0.2,
      DEEPSEEK_PRIX_ENTREE_CACHE: 6_000,
      DEEPSEEK_PRIX_ENTREE: 300_000,
      DEEPSEEK_PRIX_SORTIE: 1_200_000,
    })
    expect(choisie).toMatchObject({
      DEEPSEEK_MODELE: 'deepseek-v4-pro',
      DEEPSEEK_TEMPERATURE: 0.1,
      DEEPSEEK_PRIX_SORTIE: 2_000_000,
    })
    expect(() => lireConfig({ ...ENVIRONNEMENT_TEST, DEEPSEEK_TEMPERATURE: '0.9' })).toThrow(
      /DEEPSEEK_TEMPERATURE/,
    )
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
