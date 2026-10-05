import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { injecter } from './injecter.ts'

// Les tests tournent dans le dossier du paquet.
const SCRIPT = join(process.cwd(), 'scripts', 'injecter.ts')
const FICHE = '<html><body><script id="pont"></script><script>demarrer()</script></body></html>'

describe('injecter', () => {
  it('insère le code en ligne à la place de la balise', () => {
    const html = injecter(FICHE, 'window.JanusPont = {}')

    expect(html).toBe(
      '<html><body><script id="pont">window.JanusPont = {}</script><script>demarrer()</script></body></html>',
    )
  })

  it('protège le code qui contient </script et les motifs de remplacement', () => {
    const html = injecter(FICHE, 'a = "</script>"; b = "$&"; c = "$1"')

    expect(html).toContain('a = "<\\/script>"; b = "$&"; c = "$1"')
    expect(html.match(/<\/script>/g)).toHaveLength(2)
  })

  it('refuse une fiche sans la balise', () => {
    expect(() => injecter('<html></html>', 'x')).toThrow('balise')
  })

  it('s’utilise en ligne de commande', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'injecter-'))
    const fiche = join(dossier, 'fiche.html')
    const pont = join(dossier, 'pont.js')
    writeFileSync(fiche, FICHE)
    writeFileSync(pont, 'window.JanusPont = {}')

    execFileSync('node', [SCRIPT, fiche, pont])

    expect(readFileSync(fiche, 'utf8')).toContain(
      '<script id="pont">window.JanusPont = {}</script>',
    )
  })

  it('en ligne de commande, dit comment s’en servir sans arguments', () => {
    expect(() => execFileSync('node', [SCRIPT], { stdio: 'pipe' })).toThrow(/Usage/)
  })
})
