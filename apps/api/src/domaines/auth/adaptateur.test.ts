import { describe, expect, it } from 'vitest'
import {
  APPAREIL_INCONNU,
  appareilDepuis,
  creerHacheur,
  empreinteDuJeton,
  nouveauJeton,
} from './adaptateur.ts'

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
}

describe('appareilDepuis', () => {
  it.each([
    [UA.androidChrome, 'Android · Chrome'],
    [UA.iphoneSafari, 'iOS · Safari'],
    [UA.windowsEdge, 'Windows · Edge'],
    [UA.linuxFirefox, 'Linux · Firefox'],
    [UA.macSafari, 'macOS · Safari'],
  ])('lit %s', (userAgent, attendu) => {
    expect(appareilDepuis(userAgent)).toBe(attendu)
  })

  it('ne garde que ce qu’il reconnaît, et dit « inconnu » quand il ne reconnaît rien', () => {
    expect(appareilDepuis('curl/8.0')).toBe(APPAREIL_INCONNU)
    expect(appareilDepuis(undefined)).toBe(APPAREIL_INCONNU)
    expect(appareilDepuis('Mozilla/5.0 (Android 9) Gecko')).toBe('Android')
  })
})

describe('le jeton', () => {
  it('fait 32 octets aléatoires, jamais deux fois le même', () => {
    const jeton = nouveauJeton()

    expect(Buffer.from(jeton, 'base64url')).toHaveLength(32)
    expect(nouveauJeton()).not.toBe(jeton)
  })

  it('a pour empreinte son SHA-256, en hexadécimal', () => {
    expect(empreinteDuJeton('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('le hacheur', () => {
  const hacheur = creerHacheur(4)

  it('hache puis reconnaît le bon mot de passe, pas un autre', async () => {
    const hash = await hacheur.hacher('un mot de passe solide')

    expect(hash).toMatch(/^\$2[aby]\$04\$/)
    expect(await hacheur.comparer('un mot de passe solide', hash)).toBe(true)
    expect(await hacheur.comparer('un autre mot de passe', hash)).toBe(false)
  })

  it('refuse toujours avec le hachage factice', async () => {
    expect(await hacheur.comparerFactice('un mot de passe solide')).toBe(false)
  })

  it('prend le coût 12 par défaut', async () => {
    expect(await creerHacheur().hacher('x')).toMatch(/^\$2[aby]\$12\$/)
  })
})
