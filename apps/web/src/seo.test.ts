import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ICI = dirname(fileURLToPath(import.meta.url))
const cheminDe = (relatif: string) => resolve(ICI, relatif)
const lire = (relatif: string) => readFileSync(cheminDe(relatif), 'utf8')
const html = lire('../index.html')
const balise = (motif: RegExp) => motif.exec(html)?.[1]
const meta = (attribut: 'name' | 'property', nom: string) =>
  balise(new RegExp(`<meta\\s+${attribut}="${nom}"\\s+content="([^"]*)"`, 'u')) ??
  balise(new RegExp(`<meta\\s+${attribut}="${nom}"\\s*content="([^"]*)"`, 'u'))

const SITE = 'https://janus.akiksystems.fr/'

describe('référencement : la page d’accueil', () => {
  it('a un titre court et une description de longueur utile', () => {
    const titre = balise(/<title>([^<]*)<\/title>/u) ?? ''
    expect(titre.length).toBeGreaterThan(10)
    expect(titre.length).toBeLessThanOrEqual(60)
    const description = html.match(/name="description"\s+content="([^"]*)"/u)?.[1] ?? ''
    expect(description.length).toBeGreaterThanOrEqual(70)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('déclare la langue, une adresse canonique absolue et se laisse indexer', () => {
    expect(html).toMatch(/<html lang="fr">/u)
    expect(balise(/<link rel="canonical" href="([^"]*)"/u)).toBe(SITE)
    expect(html).toMatch(/name="robots"\s+content="index, follow, max-image-preview:large"/u)
  })

  it('a ses balises de partage, avec une image absolue qui existe à la bonne taille', () => {
    for (const nom of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) {
      expect(meta('property', nom), nom).toBeTruthy()
    }
    expect(meta('property', 'og:url')).toBe(SITE)
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    const image = meta('property', 'og:image') ?? ''
    expect(image.startsWith(SITE)).toBe(true)
    const fichier = cheminDe(`../public/${image.slice(SITE.length).split('?')[0] ?? ''}`)
    expect(existsSync(fichier)).toBe(true)
    // Les dimensions d'un PNG sont dans son en-tête IHDR (octets 16 à 23).
    const octets = readFileSync(fichier)
    expect([octets.readUInt32BE(16), octets.readUInt32BE(20)]).toEqual([1200, 630])
    expect(meta('property', 'og:image:width')).toBe('1200')
    expect(meta('property', 'og:image:height')).toBe('630')
  })

  it('porte des données structurées valides qui disent la même chose que la page', () => {
    const brut = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u)?.[1]
    const donnees = JSON.parse(brut ?? '{}') as Record<string, unknown>
    expect(donnees['@context']).toBe('https://schema.org')
    expect(donnees['@type']).toBe('WebApplication')
    expect(donnees['url']).toBe(SITE)
    expect(donnees['inLanguage']).toBe('fr-FR')
    expect(donnees['description']).toBe(html.match(/name="description"\s+content="([^"]*)"/u)?.[1])
  })

  it('dit ce qu’est Janus à qui n’exécute pas JavaScript', () => {
    expect(html).toMatch(/<noscript>[\s\S]*<h1>[^<]+<\/h1>[\s\S]*<\/noscript>/u)
  })
})

describe('référencement : robots.txt et plan du site', () => {
  const robots = lire('../public/robots.txt')
  const plan = lire('../public/sitemap.xml')

  it('annonce le plan du site et laisse l’accueil aux robots, sans l’API ni les fiches', () => {
    expect(robots).toMatch(/^User-agent: \*$/mu)
    expect(robots).toMatch(/^Allow: \/$/mu)
    expect(robots).toMatch(/^Disallow: \/api\/$/mu)
    expect(robots).toMatch(/^Disallow: \/fiches\/$/mu)
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`)
  })

  it('ne liste que l’accueil, à l’adresse canonique', () => {
    const adresses = [...plan.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(([, adresse]) => adresse)
    expect(adresses).toEqual([SITE])
  })

  it('le serveur dit non indexable tout ce qui n’est pas la vitrine', () => {
    const caddy = lire('../../../deploy/vps/Caddyfile')
    expect(caddy).toContain('X-Robots-Tag "noindex, nofollow"')
    expect(caddy).toMatch(/@hors_vitrine not path \/ \/connexion /u)
  })
})
