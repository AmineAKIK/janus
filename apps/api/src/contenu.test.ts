import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Catalogue } from '@janus/contrats'
import { describe, expect, it } from 'vitest'

const racine = join(dirname(fileURLToPath(import.meta.url)), '../../../contenu')
const lire = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'))

describe('catalogues de contenu', () => {
  it('DWWM : la formation et son premier module sont valides', () => {
    const catalogue = Catalogue.parse(lire('dwwm/catalogue.json'))

    expect(catalogue.formation.code).toBe('DWWM')
    expect(catalogue.modules.map((m) => [m.code, m.titre])).toEqual([
      ['M1', 'Écosystème et outils du développeur'],
    ])
  })
})
