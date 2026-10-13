import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validerManifeste } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { extraireManifeste } from './domaines/catalogue/composition.ts'
import { injecterLePont, nouvelleFiche, pontEstPresent } from './assemblage.ts'

const GABARIT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../contenu/dwwm/gabarit/fiche.html'),
  'utf8',
)

describe('le gabarit de fiche', () => {
  it('a un manifeste qui passe le validateur', () => {
    const resultat = validerManifeste(JSON.parse(extraireManifeste(GABARIT) ?? 'null'))
    expect(resultat.ok, JSON.stringify(resultat)).toBe(true)
  })

  it('attend le pont à sa place, sans l’avoir', () => {
    expect(pontEstPresent(GABARIT)).toBe(false)
  })
})

describe('injecterLePont', () => {
  it('écrit la bibliothèque dans la balise du pont, et protège </script', () => {
    const html = injecterLePont(GABARIT, 'window.JanusPont = "</script>$&"')
    expect(pontEstPresent(html)).toBe(true)
    expect(html).toContain('<script id="pont">window.JanusPont = "<\\/script>$&"</script>')
  })

  it('refuse une page sans la balise', () => {
    expect(() => injecterLePont('<html></html>', 'x')).toThrow(/balise/)
  })
})

describe('nouvelleFiche', () => {
  it('donne le code du bloc au manifeste et assemble le pont', () => {
    const html = nouvelleFiche(GABARIT, 'B03', 'window.JanusPont = {}')
    const manifeste = JSON.parse(extraireManifeste(html) ?? 'null') as { bloc: string }
    expect(manifeste.bloc).toBe('B03')
    expect(pontEstPresent(html)).toBe(true)
  })

  it('refuse un code de bloc invalide', () => {
    expect(() => nouvelleFiche(GABARIT, 'bloc 3', 'x')).toThrow(/code de bloc/)
  })
})
