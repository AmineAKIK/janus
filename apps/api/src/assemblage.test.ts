import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validerManifeste } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { extraireManifeste } from './domaines/catalogue/composition.ts'
import {
  BLOCS_FIXES,
  blocsFixes,
  contenuDuBloc,
  enTeteDuPont,
  injecterLePont,
  nouvelleFiche,
  pontEmbarque,
  pontEstPresent,
  remplacerLePont,
  remplacerLesBlocsFixes,
} from './assemblage.ts'

const EMPREINTE = 'a'.repeat(64)
const PONT = `/*! janus-pont v1 ${EMPREINTE} */\nwindow.JanusPont = {}`

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

  it('a ses trois blocs fixes, pleins, et ses deux blocs libres, vides', () => {
    const fixes = blocsFixes(GABARIT)
    expect([...fixes.keys()]).toEqual([...BLOCS_FIXES])
    for (const contenu of fixes.values()) expect(contenu.trim()).not.toBe('')
    expect(contenuDuBloc(GABARIT, 'styles-bloc')).toBe('')
    expect(contenuDuBloc(GABARIT, 'outils-bloc')).toBe('')
    expect(contenuDuBloc(GABARIT, 'inconnu')).toBeUndefined()
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

describe('enTeteDuPont', () => {
  it('lit la version et l’empreinte, même après un reformatage qui indente', () => {
    expect(enTeteDuPont(PONT)).toEqual({ version: 1, empreinte: EMPREINTE })
    expect(enTeteDuPont(`\n      /*! janus-pont v12 ${EMPREINTE} */\n      window.x = 1`)).toEqual({
      version: 12,
      empreinte: EMPREINTE,
    })
  })

  it('ne lit rien sans en-tête, ou avec une empreinte qui n’en est pas une', () => {
    expect(enTeteDuPont('window.JanusPont = {}')).toBeUndefined()
    expect(enTeteDuPont('/*! janus-pont v1 abc */')).toBeUndefined()
  })
})

describe('pontEmbarque et remplacerLePont', () => {
  it('rend le code embarqué, </script rétabli, et rien sans pont', () => {
    const html = injecterLePont(GABARIT, 'window.JanusPont = "</script>"')
    expect(pontEmbarque(html)).toBe('window.JanusPont = "</script>"')
    expect(pontEmbarque(GABARIT)).toBeUndefined()
    expect(pontEmbarque('<html></html>')).toBeUndefined()
  })

  it('remplace un pont déjà embarqué, et écrit dans une balise vide', () => {
    const ancienne = injecterLePont(GABARIT, 'window.JanusPont = "vieux</script>"')
    const neuve = remplacerLePont(ancienne, PONT)
    expect(pontEmbarque(neuve)).toBe(PONT)
    expect(neuve).not.toContain('vieux')
    expect(neuve.replace(PONT, 'window.JanusPont = {}')).toBe(
      injecterLePont(GABARIT, 'window.JanusPont = {}'),
    )
    expect(remplacerLePont(GABARIT, PONT)).toBe(injecterLePont(GABARIT, PONT))
    expect(() => remplacerLePont('<html></html>', PONT)).toThrow(/balise/)
  })
})

describe('les blocs fixes du gabarit dans une fiche', () => {
  const abimee = GABARIT.replace('<style id="styles-gabarit">', '<style id="styles-gabarit">.x{}')
    .replace('<style id="styles-bloc"></style>', '<style id="styles-bloc">.y{}</style>')
    .replace('<script id="outils-bloc"></script>', '<script id="outils-bloc">y()</script>')

  it('remplace chaque bloc fixe par celui du gabarit, sans toucher aux blocs libres', () => {
    const reparee = remplacerLesBlocsFixes(abimee, GABARIT)
    for (const [id, contenu] of blocsFixes(GABARIT))
      expect(contenuDuBloc(reparee, id)).toBe(contenu)
    expect(contenuDuBloc(reparee, 'styles-bloc')).toBe('.y{}')
    expect(contenuDuBloc(reparee, 'outils-bloc')).toBe('y()')
    expect(remplacerLesBlocsFixes(GABARIT, GABARIT)).toBe(GABARIT)
  })

  it('refuse une fiche qui a perdu un bloc fixe, et un gabarit qui n’en a plus', () => {
    const sans = GABARIT.replace('<script id="plomberie">', '<script>')
    expect(() => remplacerLesBlocsFixes(sans, GABARIT)).toThrow(/bloc fixe id="plomberie"/)
    expect(() => blocsFixes(sans)).toThrow(/gabarit n’a plus de bloc fixe id="plomberie"/)
  })
})
