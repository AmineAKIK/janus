import { validerManifeste } from '@janus/contrats'
import manifesteDemo from '../../../packages/contrats/fixtures/manifeste-demo.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// La fiche de démonstration est un fichier seul ; ces tests la tiennent d'accord avec le reste du dépôt.
const fiche = readFileSync(join(process.cwd(), 'public/fiches/demo/fiche-demo.html'), 'utf8')

function manifesteEmbarque(): unknown {
  const brut = /<script id="manifeste" type="application\/json">([\s\S]*?)<\/script>/.exec(
    fiche,
  )?.[1]
  if (brut === undefined) throw new Error('Manifeste introuvable dans la fiche')
  return JSON.parse(brut)
}

describe('fiche-demo.html', () => {
  it('embarque le manifeste D01, identique à celui des contrats et valide', () => {
    expect(manifesteEmbarque()).toEqual(manifesteDemo)
    expect(validerManifeste(manifesteEmbarque()).ok).toBe(true)
  })

  it('attend la bibliothèque du pont à sa place, pour que le build l’y insère', () => {
    expect(fiche.match(/<script id="pont"><\/script>/g)).toHaveLength(1)
  })
})
